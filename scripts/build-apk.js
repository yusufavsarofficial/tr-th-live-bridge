const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const packageJson = require("../package.json");

const root = path.resolve(__dirname, "..");
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
const webUrl = process.env.PINGLE_WEB_URL || "https://tr-th-live-bridge.onrender.com";
const packageName = "com.ayfsoft.pingle";
const minSdkVersion = Number(process.env.PINGLE_MIN_SDK_VERSION) || 21;
const versionName = String(process.env.PINGLE_APK_VERSION_NAME || packageJson.version || "1.0.1");
const tempDir = path.join(root, ".apk-build");
const distDir = path.join(root, "dist");
const apkOut = path.join(distDir, "Pingle.apk");
const unsignedApk = path.join(tempDir, "unsigned.apk");
const alignedApk = path.join(tempDir, "aligned.apk");
const keyDir = path.join(root, ".apk-keystore");
const keyStore = path.join(keyDir, "pingle-upload.jks");

function versionCodeFromName(value) {
  const [major = 0, minor = 0, patch = 0] = String(value)
    .split(/[^\d]+/)
    .filter(Boolean)
    .map((part) => Number(part) || 0);
  return Math.max(1, major * 10000 + minor * 100 + patch);
}

function apiLevelFromPlatform(platformName) {
  const match = String(platformName || "").match(/android-(\d+)/i);
  return match ? Number(match[1]) : 35;
}

function fail(message) {
  throw new Error(message);
}

function newestDir(base, filter = () => true) {
  if (!fs.existsSync(base)) {
    return "";
  }
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .filter(filter)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    [0] || "";
}

function newestStableAndroidPlatform(base) {
  const preferredApi = Number(process.env.PINGLE_COMPILE_SDK_VERSION) || 35;
  return (
    newestDir(base, (name) => {
      const api = apiLevelFromPlatform(name);
      return /^android-\d+$/i.test(name) && api <= preferredApi;
    }) || newestDir(base, (name) => /^android-\d+$/i.test(name))
  );
}

function tool(...parts) {
  return path.join(sdkRoot, ...parts);
}

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function run(command, args, options = {}) {
  const isBatch = process.platform === "win32" && /\.(bat|cmd)$/i.test(command);
  const result = spawnSync(
    isBatch ? process.env.ComSpec || "cmd.exe" : command,
    isBatch ? ["/d", "/s", "/c", `call ${[command, ...args].map(quoteCmdArg).join(" ")}`] : args,
    {
    cwd: options.cwd || root,
    encoding: "utf8",
    stdio: options.quiet ? "pipe" : "inherit",
    },
  );
  if (result.status !== 0) {
    const detail = [result.error && String(result.error), result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    fail(`${path.basename(command)} failed${detail ? `:\n${detail}` : ""}`);
  }
  return result;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const itemPath = path.join(dir, item.name);
    return item.isDirectory() ? listFiles(itemPath) : itemPath;
  });
}

async function main() {
  const platform = newestStableAndroidPlatform(path.join(sdkRoot, "platforms"));
  const buildTools = newestDir(path.join(sdkRoot, "build-tools"));
  if (!platform || !buildTools) {
    fail("Android SDK platform/build-tools not found. Set ANDROID_HOME or ANDROID_SDK_ROOT.");
  }
  const platformApi = apiLevelFromPlatform(platform);
  const targetSdkVersion = Number(process.env.PINGLE_TARGET_SDK_VERSION) || Math.min(platformApi, 35);
  const versionCode = Number(process.env.PINGLE_APK_VERSION_CODE) || versionCodeFromName(versionName);

  const androidJar = tool("platforms", platform, "android.jar");
  const aapt2 = tool("build-tools", buildTools, "aapt2.exe");
  const d8Jar = tool("build-tools", buildTools, "lib", "d8.jar");
  const zipalign = tool("build-tools", buildTools, "zipalign.exe");
  const apksignerJar = tool("build-tools", buildTools, "lib", "apksigner.jar");

  for (const required of [androidJar, aapt2, d8Jar, zipalign, apksignerJar]) {
    if (!fs.existsSync(required)) {
      fail(`Missing Android tool: ${required}`);
    }
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(distDir, { recursive: true });

  const srcDir = path.join(tempDir, "src", "com", "ayfsoft", "pingle");
  const resDir = path.join(tempDir, "res");
  const genDir = path.join(tempDir, "gen");
  const classesDir = path.join(tempDir, "classes");
  const dexDir = path.join(tempDir, "dex");
  const flatDir = path.join(tempDir, "flat");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(classesDir, { recursive: true });
  fs.mkdirSync(dexDir, { recursive: true });
  fs.mkdirSync(flatDir, { recursive: true });

  write(
    path.join(tempDir, "AndroidManifest.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="${packageName}" android:versionCode="${versionCode}" android:versionName="${versionName}">
  <uses-sdk android:minSdkVersion="${minSdkVersion}" android:targetSdkVersion="${targetSdkVersion}" />
  <supports-screens android:smallScreens="true" android:normalScreens="true" android:largeScreens="true" android:xlargeScreens="true" android:anyDensity="true" />
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.RECORD_AUDIO" />
  <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
  <uses-feature android:name="android.hardware.camera" android:required="false" />
  <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
  <uses-feature android:name="android.hardware.microphone" android:required="false" />
  <application android:theme="@style/AppTheme" android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" android:usesCleartextTraffic="true" android:hardwareAccelerated="true" android:resizeableActivity="true" android:supportsRtl="true">
    <activity android:name=".MainActivity" android:exported="true" android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" android:configChanges="orientation|screenSize|keyboardHidden">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
`,
  );

  write(
    path.join(resDir, "values", "strings.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="app_name">Pingle</string>
  <string name="pingle_url">${webUrl.replace(/&/g, "&amp;")}</string>
</resources>
`,
  );

  write(
    path.join(resDir, "values", "colors.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="ic_launcher_background">#071217</color>
  <color name="status_bar">#0b1014</color>
  <color name="navigation_bar">#0b1014</color>
</resources>
`,
  );

  write(
    path.join(resDir, "values", "styles.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="AppTheme" parent="@android:style/Theme.Material.NoActionBar">
    <item name="android:windowNoTitle">true</item>
    <item name="android:windowActionBar">false</item>
    <item name="android:windowLightStatusBar">false</item>
    <item name="android:statusBarColor">@color/status_bar</item>
    <item name="android:navigationBarColor">@color/navigation_bar</item>
  </style>
</resources>
`,
  );

  write(
    path.join(resDir, "drawable", "ic_launcher_foreground.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#18E891" android:pathData="M19,23h58c10,0 18,8 18,18v27c0,10 -8,18 -18,18H49L25,101l5,-15H19C9,86 1,78 1,68V41c0,-10 8,-18 18,-18z"/>
  <path android:fillColor="#12B7D8" android:pathData="M75,12h13c8,0 15,7 15,15s-7,15 -15,15H78L66,51l4,-13c-6,-3 -10,-9 -10,-16 0,-6 5,-10 15,-10z"/>
  <path android:fillColor="#071217" android:pathData="M35,35h27c14,0 24,9 24,22s-10,22 -24,22H50v14H35V35zM50,49v16h12c6,0 9,-3 9,-8s-3,-8 -9,-8H50z"/>
  <path android:fillColor="#FFE7A5" android:pathData="M74,24h19v5H74zM74,34h13v5H74z"/>
</vector>
`,
  );

  write(
    path.join(resDir, "drawable", "ic_notification.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF" android:pathData="M3,5.2C3,3.4 4.4,2 6.2,2h11.6C19.6,2 21,3.4 21,5.2v7.9c0,1.8 -1.4,3.2 -3.2,3.2h-6.1L6,21v-4.7C4.3,16.2 3,14.8 3,13.1V5.2z"/>
  <path android:fillColor="#FF071217" android:pathData="M8,6h5.3c2.8,0 4.7,1.8 4.7,4.4s-1.9,4.4 -4.7,4.4h-2.4V18H8V6zM10.9,8.5v3.8h2.2c1.2,0 2,-0.7 2,-1.9s-0.8,-1.9 -2,-1.9h-2.2z"/>
</vector>
`,
  );

  const legacyLauncherVector = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#071217" android:pathData="M0,0h108v108h-108z"/>
  <path android:fillColor="#18E891" android:pathData="M19,23h58c10,0 18,8 18,18v27c0,10 -8,18 -18,18H49L25,101l5,-15H19C9,86 1,78 1,68V41c0,-10 8,-18 18,-18z"/>
  <path android:fillColor="#12B7D8" android:pathData="M75,12h13c8,0 15,7 15,15s-7,15 -15,15H78L66,51l4,-13c-6,-3 -10,-9 -10,-16 0,-6 5,-10 15,-10z"/>
  <path android:fillColor="#071217" android:pathData="M35,35h27c14,0 24,9 24,22s-10,22 -24,22H50v14H35V35zM50,49v16h12c6,0 9,-3 9,-8s-3,-8 -9,-8H50z"/>
  <path android:fillColor="#FFE7A5" android:pathData="M74,24h19v5H74zM74,34h13v5H74z"/>
</vector>
`;

  write(path.join(resDir, "mipmap", "ic_launcher.xml"), legacyLauncherVector);
  write(path.join(resDir, "mipmap", "ic_launcher_round.xml"), legacyLauncherVector);

  write(
    path.join(resDir, "mipmap-anydpi-v26", "ic_launcher.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/ic_launcher_background"/>
  <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`,
  );

  write(
    path.join(resDir, "mipmap-anydpi-v26", "ic_launcher_round.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/ic_launcher_background"/>
  <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`,
  );

  write(
    path.join(srcDir, "MainActivity.java"),
    `package com.ayfsoft.pingle;

import android.Manifest;
import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.webkit.*;
import android.widget.*;
import java.util.*;

public class MainActivity extends Activity {
  private WebView webView;
  private ValueCallback<Uri[]> filePathCallback;
  private static final int FILE_REQ = 4101;
  private static final String CHANNEL_ID = "pingle_alerts";

  public void onCreate(Bundle bundle) {
    super.onCreate(bundle);
    createNotificationChannel();
    requestNeededPermissions();
    openWebView(getSharedPreferences("pingle", MODE_PRIVATE).getString("url", getString(getResources().getIdentifier("pingle_url", "string", getPackageName()))));
  }

  private void requestNeededPermissions() {
    if (Build.VERSION.SDK_INT >= 33) {
      requestPermissions(new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS}, 50);
    } else if (Build.VERSION.SDK_INT >= 23) {
      requestPermissions(new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO}, 50);
    }
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Pingle bildirimleri", NotificationManager.IMPORTANCE_HIGH);
      channel.setDescription("Mesaj ve arama bildirimleri");
      channel.enableVibration(true);
      NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
      manager.createNotificationChannel(channel);
    }
  }

  private void openWebView(String url) {
    webView = new WebView(this);
    setContentView(webView);
    webView.addJavascriptInterface(new PingleBridge(), "PingleAndroid");
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(true);
    settings.setLoadWithOverviewMode(true);
    settings.setUseWideViewPort(true);

    webView.setWebViewClient(new WebViewClient() {
      public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (Build.VERSION.SDK_INT >= 21 && request.isForMainFrame()) showUrlDialog(url);
      }
      public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
        showUrlDialog(url);
      }
    });
    webView.setWebChromeClient(new WebChromeClient() {
      public void onPermissionRequest(final PermissionRequest request) {
        if (Build.VERSION.SDK_INT >= 21) runOnUiThread(() -> request.grant(request.getResources()));
      }
      public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (filePathCallback != null) filePathCallback.onReceiveValue(null);
        filePathCallback = callback;
        Intent intent = params.createIntent();
        try {
          startActivityForResult(intent, FILE_REQ);
        } catch (Exception ex) {
          filePathCallback = null;
          Toast.makeText(MainActivity.this, "Dosya se\\u00e7ici a\\u00e7\\u0131lamad\\u0131", Toast.LENGTH_LONG).show();
          return false;
        }
        return true;
      }
    });
    webView.setOnLongClickListener(v -> {
      showUrlDialog(webView.getUrl());
      return true;
    });
    webView.loadUrl(url);
  }

  private void showUrlDialog(String current) {
    final EditText input = new EditText(this);
    input.setSingleLine(true);
    input.setText(current == null ? "" : current);
    input.setSelection(input.getText().length());
    new AlertDialog.Builder(this)
      .setTitle("Pingle Render adresi")
      .setMessage("Render URL adresini gir. Uzun bas\\u0131nca bu ekran tekrar a\\u00e7\\u0131l\\u0131r.")
      .setView(input)
      .setPositiveButton("A\\u00e7", (dialog, which) -> {
        String next = input.getText().toString().trim();
        if (!next.startsWith("http")) next = "https://" + next;
        getSharedPreferences("pingle", MODE_PRIVATE).edit().putString("url", next).apply();
        webView.loadUrl(next);
      })
      .setNegativeButton("Vazge\\u00e7", null)
      .show();
    input.requestFocus();
    input.postDelayed(() -> ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showSoftInput(input, 0), 250);
  }

  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == FILE_REQ && filePathCallback != null) {
      Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
      filePathCallback.onReceiveValue(result);
      filePathCallback = null;
    }
  }

  private void showNativeNotification(String title, String body, String tag) {
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      return;
    }

    Intent intent = new Intent(this, MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) {
      flags |= PendingIntent.FLAG_IMMUTABLE;
    }
    PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);
    int smallIcon = getResources().getIdentifier("ic_notification", "drawable", getPackageName());
    Notification.Builder builder = Build.VERSION.SDK_INT >= 26
      ? new Notification.Builder(this, CHANNEL_ID)
      : new Notification.Builder(this);

    builder
      .setSmallIcon(smallIcon)
      .setContentTitle(title == null || title.length() == 0 ? "Pingle" : title)
      .setContentText(body == null ? "" : body)
      .setStyle(new Notification.BigTextStyle().bigText(body == null ? "" : body))
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .setColor(0xFF25D366)
      .setPriority(Notification.PRIORITY_HIGH);

    NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    int id = Math.abs((String.valueOf(tag) + String.valueOf(title) + String.valueOf(body)).hashCode());
    manager.notify(id == 0 ? 6107 : id, builder.build());
  }

  public class PingleBridge {
    @JavascriptInterface
    public void notify(String title, String body, String tag) {
      runOnUiThread(() -> showNativeNotification(title, body, tag));
    }
  }

  public void onBackPressed() {
    if (webView != null && webView.canGoBack()) webView.goBack();
    else super.onBackPressed();
  }
}
`,
  );

  run(aapt2, ["compile", "--dir", resDir, "-o", flatDir]);
  const flats = fs.readdirSync(flatDir).map((name) => path.join(flatDir, name));
  run(aapt2, [
    "link",
    "-o",
    unsignedApk,
    "-I",
    androidJar,
    "--manifest",
    path.join(tempDir, "AndroidManifest.xml"),
    "--java",
    genDir,
    "--min-sdk-version",
    String(minSdkVersion),
    "--target-sdk-version",
    String(targetSdkVersion),
    "--version-code",
    String(versionCode),
    "--version-name",
    versionName,
    "--replace-version",
    "--auto-add-overlay",
    ...flats,
  ]);

  const javaFiles = [
    path.join(srcDir, "MainActivity.java"),
    path.join(genDir, "com", "ayfsoft", "pingle", "R.java"),
  ];
  run("javac", ["-encoding", "UTF-8", "-source", "1.8", "-target", "1.8", "-classpath", androidJar, "-d", classesDir, ...javaFiles]);
  const classFiles = listFiles(classesDir).filter((file) => file.endsWith(".class"));
  if (!classFiles.length) {
    fail("Java compilation produced no .class files.");
  }
  run("java", [
    "-cp",
    d8Jar,
    "com.android.tools.r8.D8",
    "--lib",
    androidJar,
    "--min-api",
    String(minSdkVersion),
    "--output",
    dexDir,
    ...classFiles,
  ]);

  const withDex = path.join(tempDir, "with-dex.apk");
  fs.copyFileSync(unsignedApk, withDex);
  run("jar", ["uf", withDex, "-C", dexDir, "classes.dex"]);
  run(zipalign, ["-f", "4", withDex, alignedApk]);

  fs.mkdirSync(keyDir, { recursive: true });
  if (!fs.existsSync(keyStore)) {
    const password = crypto.createHash("sha256").update("pingle-ayfsoft-yusuf-avsar").digest("hex").slice(0, 24);
    fs.writeFileSync(path.join(keyDir, "password.txt"), password, "utf8");
    run("keytool", [
      "-genkeypair",
      "-v",
      "-keystore",
      keyStore,
      "-storepass",
      password,
      "-keypass",
      password,
      "-alias",
      "pingle",
      "-keyalg",
      "RSA",
      "-keysize",
      "2048",
      "-validity",
      "10000",
      "-dname",
      "CN=AYFSOFT Yusuf Avsar, OU=Pingle, O=AYFSOFT, L=Istanbul, S=Istanbul, C=TR",
    ]);
  }
  const password = fs.readFileSync(path.join(keyDir, "password.txt"), "utf8").trim();
  fs.rmSync(apkOut, { force: true });
  fs.rmSync(`${apkOut}.idsig`, { force: true });
  run("java", [
    "-jar",
    apksignerJar,
    "sign",
    "--v4-signing-enabled",
    "false",
    "--ks",
    keyStore,
    "--ks-key-alias",
    "pingle",
    "--ks-pass",
    `pass:${password}`,
    "--key-pass",
    `pass:${password}`,
    "--out",
    apkOut,
    alignedApk,
  ]);
  run("java", ["-jar", apksignerJar, "verify", "--verbose", apkOut]);
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log(`APK ready: ${apkOut}`);
  console.log(`Web URL: ${webUrl}`);
  console.log(`Android: minSdk ${minSdkVersion}, targetSdk ${targetSdkVersion}, version ${versionName} (${versionCode})`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
