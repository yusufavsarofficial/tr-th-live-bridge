package com.pingle.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = PingleGreen,
    secondary = PingleGreenDeep,
    tertiary = PingleMine,
    background = PingleBackground,
    surface = PingleSurface,
    surfaceVariant = PingleSurfaceAlt,
    onPrimary = PingleBackground,
    onSecondary = PingleText,
    onTertiary = PingleText,
    onBackground = PingleText,
    onSurface = PingleText,
    onSurfaceVariant = PingleMuted,
    error = PingleDanger
)

@Composable
fun PingleTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}
