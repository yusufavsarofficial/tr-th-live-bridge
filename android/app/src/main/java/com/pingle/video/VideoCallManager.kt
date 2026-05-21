package com.pingle.video

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.YuvImage
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.util.Base64
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import io.socket.client.Socket
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors

class VideoCallManager(
    private val lifecycleOwner: LifecycleOwner,
    private val socket: Socket,
    private val conversationId: String,
    private val userId: String,
    private val isVideoCall: Boolean,
) {
    private var cameraProvider: ProcessCameraProvider? = null
    private var previewUseCase: Preview? = null
    private var analysisUseCase: ImageAnalysis? = null
    private var isCapturing = false
    private var isMuted = false
    private var cameraEnabled = true
    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var isCallActive = false
    private val executor = Executors.newSingleThreadExecutor()

    private var onRemoteFrame: ((Bitmap) -> Unit)? = null
    private var onCallEnded: (() -> Unit)? = null

    fun setOnRemoteFrame(callback: (Bitmap) -> Unit) { onRemoteFrame = callback }
    fun setOnCallEnded(callback: () -> Unit) { onCallEnded = callback }

    fun startCamera(previewView: PreviewView) {
        if (!isVideoCall) return
        val cameraProviderFuture = ProcessCameraProvider.getInstance(previewView.context)
        cameraProviderFuture.addListener({
            cameraProvider = cameraProviderFuture.get()
            bindPreview(previewView)
        }, ContextCompat.getMainExecutor(previewView.context))
    }

    private fun bindPreview(previewView: PreviewView) {
        val provider = cameraProvider ?: return
        provider.unbindAll()

        val rotation = previewView.display?.rotation ?: android.view.Surface.ROTATION_0
        val screenAspectRatio = when (rotation) {
            android.view.Surface.ROTATION_0, android.view.Surface.ROTATION_180 -> AspectRatio.RATIO_16_9
            else -> AspectRatio.RATIO_4_3
        }

        previewUseCase = Preview.Builder()
            .setTargetAspectRatio(screenAspectRatio)
            .setTargetRotation(rotation)
            .build()
            .also { it.setSurfaceProvider(previewView.surfaceProvider) }

        analysisUseCase = ImageAnalysis.Builder()
            .setTargetAspectRatio(screenAspectRatio)
            .setTargetRotation(rotation)
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { analysis ->
                analysis.setAnalyzer(executor) { imageProxy ->
                    if (isCapturing) {
                        imageProxy.close()
                        return@setAnalyzer
                    }
                    isCapturing = true
                    val bitmap = imageProxyToBitmap(imageProxy)
                    imageProxy.close()
                    if (bitmap != null) {
                        sendVideoFrame(bitmap)
                    }
                    isCapturing = false
                }
            }

        try {
            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
            provider.bindToLifecycle(lifecycleOwner, cameraSelector, previewUseCase, analysisUseCase)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun imageProxyToBitmap(image: ImageProxy): Bitmap? {
        return try {
            val buffer = image.planes[0].buffer
            val bytes = ByteArray(buffer.remaining())
            buffer.get(bytes)
            val yuvImage = YuvImage(bytes, ImageFormat.NV21, image.width, image.height, null)
            val out = ByteArrayOutputStream()
            yuvImage.compressToJpeg(android.graphics.Rect(0, 0, image.width, image.height), 50, out)
            val jpegData = out.toByteArray()
            BitmapFactory.decodeByteArray(jpegData, 0, jpegData.size)
        } catch (e: Exception) { null }
    }

    private fun sendVideoFrame(bitmap: Bitmap) {
        if (!isCallActive) return
        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 40, stream)
        val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        stream.close()
        socket.emit("call:frame", JSONObject()
            .put("conversationId", conversationId)
            .put("from", userId)
            .put("imageData", "data:image/jpeg;base64,$base64")
            .put("timestamp", System.currentTimeMillis()))
    }

    fun startCall() {
        isCallActive = true
        if (!isMuted) startAudioCapture()
    }

    fun endCall() {
        isCallActive = false
        stopAudioCapture()
        stopAudioPlayback()
        cameraProvider?.unbindAll()
        cameraProvider = null
        onCallEnded?.invoke()
    }

    fun toggleMute(): Boolean {
        isMuted = !isMuted
        if (isMuted) stopAudioCapture()
        else if (isCallActive) startAudioCapture()
        return isMuted
    }

    fun toggleCamera(): Boolean {
        cameraEnabled = !cameraEnabled
        return cameraEnabled
    }

    fun handleRemoteFrame(imageData: String) {
        try {
            val base64 = imageData.substringAfter("base64,")
            val bytes = Base64.decode(base64, Base64.NO_WRAP)
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            if (bitmap != null) {
                onRemoteFrame?.invoke(bitmap)
            }
        } catch (e: Exception) { e.printStackTrace() }
    }

    fun handleRemoteAudio(audioData: ByteArray) {
        if (audioTrack == null) {
            val minBufferSize = AudioTrack.getMinBufferSize(8000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
            audioTrack = AudioTrack.Builder()
                .setAudioFormat(AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(8000)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build())
                .setBufferSizeInBytes(minBufferSize)
                .build()
            audioTrack?.play()
        }
        audioTrack?.write(audioData, 0, audioData.size)
    }

    private fun startAudioCapture() {
        try {
            val minBufferSize = AudioRecord.getMinBufferSize(8000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            audioRecord = AudioRecord.Builder()
                .setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION)
                .setAudioFormat(AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(8000)
                    .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                    .build())
                .setBufferSizeInBytes(minBufferSize)
                .build()
            audioRecord?.startRecording()
            executor.submit {
                val buffer = ByteArray(minBufferSize)
                while (isCallActive && !isMuted && audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    val read = audioRecord?.read(buffer, 0, buffer.size) ?: -1
                    if (read > 0 && isCallActive) {
                        val audioBase64 = Base64.encodeToString(buffer.copyOf(read), Base64.NO_WRAP)
                        socket.emit("call:audio", JSONObject()
                            .put("conversationId", conversationId)
                            .put("from", userId)
                            .put("audioData", audioBase64)
                            .put("timestamp", System.currentTimeMillis()))
                    }
                }
            }
        } catch (e: Exception) { e.printStackTrace() }
    }

    private fun stopAudioCapture() {
        try {
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
        } catch (e: Exception) { e.printStackTrace() }
    }

    private fun stopAudioPlayback() {
        try {
            audioTrack?.stop()
            audioTrack?.release()
            audioTrack = null
        } catch (e: Exception) { e.printStackTrace() }
    }
}
