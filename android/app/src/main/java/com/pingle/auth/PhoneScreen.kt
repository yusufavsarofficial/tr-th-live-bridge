package com.pingle.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pingle.i18n.*

enum class Country(val code: String, val phone: String, val flag: String, val lang: PingleLanguage) {
    TURKEY("+90", "+905514883842", "🇹🇷", PingleLanguage.TURKISH),
    THAILAND("+66", "+66642177978", "🇹🇭", PingleLanguage.THAI),
}

@Composable
fun PhoneScreen(
    onSendOtp: (String) -> Unit,
    isLoading: Boolean,
    error: String?,
    onLegalClick: () -> Unit = {}
) {
    var selectedCountry by remember { mutableStateOf<Country?>(null) }
    var phone by remember { mutableStateOf("") }
    val s = LocalStrings.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(32.dp)
            .imePadding(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Spacer(Modifier.weight(1f))

        Text("Nova", color = MaterialTheme.colorScheme.primary, fontSize = 42.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(24.dp))
        Text("Hesabını seç", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
        Spacer(Modifier.height(16.dp))

        Country.entries.forEach { country ->
            val isSelected = selectedCountry == country
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .padding(vertical = 4.dp)
                    .then(if (isSelected) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(16.dp)) else Modifier)
                    .clip(RoundedCornerShape(16.dp))
                    .clickable {
                        selectedCountry = country
                        phone = country.phone
                    },
                color = if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(16.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(country.flag, fontSize = 28.sp)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(country.code, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                        Text(
                            when (country) {
                                Country.TURKEY -> "Yusuf Avşar"
                                Country.THAILAND -> "Thailand User"
                            },
                            color = MaterialTheme.colorScheme.onSurface,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    if (isSelected) {
                        Text("✓", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        Spacer(Modifier.height(24.dp))

        if (error != null) {
            Text(error, color = MaterialTheme.colorScheme.error, fontSize = 14.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(12.dp))
        }

        Button(
            onClick = { if (selectedCountry != null) onSendOtp(phone) },
            enabled = selectedCountry != null && !isLoading,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary, contentColor = MaterialTheme.colorScheme.onPrimary),
            shape = RoundedCornerShape(25.dp)
        ) {
            if (isLoading) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
            } else {
                Text("Giriş Yap", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(Modifier.weight(1f))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            TextButton(onClick = onLegalClick) {
                Text(s.legal, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f), fontSize = 12.sp)
            }
            Text(" · ", color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f), fontSize = 12.sp)
            TextButton(onClick = onLegalClick) {
                Text(s.kvkk, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f), fontSize = 12.sp)
            }
            Text(" · ", color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f), fontSize = 12.sp)
            TextButton(onClick = onLegalClick) {
                Text(s.cookies, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f), fontSize = 12.sp)
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}
