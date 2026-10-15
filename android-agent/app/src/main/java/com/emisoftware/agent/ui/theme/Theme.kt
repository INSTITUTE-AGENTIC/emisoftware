package com.emisoftware.agent.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val BrandPrimary = Color(0xFF0F172A)
val BrandDanger = Color(0xFFDC2626)
val BrandSuccess = Color(0xFF16A34A)
val BrandSurface = Color(0xFFF8FAFC)

private val LightColors = lightColorScheme(
    primary = BrandPrimary,
    error = BrandDanger,
    background = BrandSurface,
    surface = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF60A5FA),
    error = Color(0xFFF87171),
    background = Color(0xFF0B1120),
    surface = Color(0xFF111827),
)

@Composable
fun EmiLockAgentTheme(darkTheme: Boolean = false, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
