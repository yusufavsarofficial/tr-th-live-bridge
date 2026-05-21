package com.pingle.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = PingleGreen,
    onPrimary = PingleBackground,
    primaryContainer = PingleMine,
    onPrimaryContainer = PingleText,
    secondary = PingleGreenDeep,
    onSecondary = PingleText,
    tertiary = Color(0xFF00A884),
    onTertiary = PingleText,
    background = PingleBackground,
    onBackground = PingleText,
    surface = PingleSurface,
    onSurface = PingleText,
    surfaceVariant = PingleSurfaceAlt,
    onSurfaceVariant = PingleMuted,
    error = PingleDanger,
    onError = Color.White,
    outline = PingleMuted.copy(alpha = 0.3f),
    outlineVariant = PingleSurfaceAlt,
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF00A884),
    onPrimary = Color.White,
    primaryContainer = LightMine,
    onPrimaryContainer = LightText,
    secondary = Color(0xFF075E54),
    onSecondary = Color.White,
    tertiary = PingleGreen,
    onTertiary = Color.White,
    background = LightBackground,
    onBackground = LightText,
    surface = LightSurface,
    onSurface = LightText,
    surfaceVariant = LightSurfaceAlt,
    onSurfaceVariant = LightMuted,
    error = PingleDanger,
    onError = Color.White,
    outline = Color(0xFFE9EDEF),
    outlineVariant = Color(0xFFF0F2F5),
)

@Composable
fun PingleTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) androidx.compose.material3.dynamicDarkColorScheme(context)
            else androidx.compose.material3.dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
