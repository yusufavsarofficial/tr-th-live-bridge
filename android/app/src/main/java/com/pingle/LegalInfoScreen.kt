package com.pingle

import com.pingle.i18n.LocalStrings
import com.pingle.i18n.LocalizedStrings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

enum class LegalTab { COPYRIGHT, KVKK, COOKIES }

@Composable
fun LegalInfoScreen(onBack: () -> Unit) {
    var selectedTab by remember { mutableStateOf(LegalTab.COPYRIGHT) }
    val s = LocalStrings.current

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).statusBarsPadding()) {
        Row(modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(horizontal = 4.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = s.back, tint = MaterialTheme.colorScheme.onSurface)
            }
            Text(s.legal, color = MaterialTheme.colorScheme.onSurface, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
        }

        TabRow(
            selectedTabIndex = selectedTab.ordinal,
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.primary,
        ) {
            Tab(selected = selectedTab == LegalTab.COPYRIGHT, onClick = { selectedTab = LegalTab.COPYRIGHT }, text = { Text(s.copyright, fontWeight = if (selectedTab == LegalTab.COPYRIGHT) FontWeight.Bold else FontWeight.Normal) })
            Tab(selected = selectedTab == LegalTab.KVKK, onClick = { selectedTab = LegalTab.KVKK }, text = { Text("KVKK", fontWeight = if (selectedTab == LegalTab.KVKK) FontWeight.Bold else FontWeight.Normal) })
            Tab(selected = selectedTab == LegalTab.COOKIES, onClick = { selectedTab = LegalTab.COOKIES }, text = { Text(s.cookies, fontWeight = if (selectedTab == LegalTab.COOKIES) FontWeight.Bold else FontWeight.Normal) })
        }

        Column(
            modifier = Modifier.fillMaxSize().padding(20.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            when (selectedTab) {
                LegalTab.COPYRIGHT -> CopyrightContent()
                LegalTab.KVKK -> KvkkContent()
                LegalTab.COOKIES -> CookiesContent()
            }
        }
    }
}

@Composable
private fun CopyrightContent() {
    Text("© 2026 AYFSOFT PTE. LTD. & YUSUF AVŞAR", color = MaterialTheme.colorScheme.onSurface, fontSize = 18.sp, fontWeight = FontWeight.Bold)
    Divider(color = MaterialTheme.colorScheme.outlineVariant)
    Text("""
Nova is a private communication platform developed by AYFSOFT PTE. LTD. (Singapore) and Yusuf Avşar (Turkey). All rights reserved.

This software, including its source code, visual design, brand identity, and underlying framework, is protected by international copyright laws and international treaty provisions. Unauthorized reproduction, distribution, modification, reverse engineering, or creation of derivative works is strictly prohibited without prior written consent from the copyright holders.

The Nova name, logo, and related trademarks are the exclusive property of AYFSOFT PTE. LTD. Any use of these marks without authorization is a violation of applicable trademark and intellectual property laws.

For licensing inquiries, partnership opportunities, or permissions, please contact:

Email: legal@ayfsoft.com
Address: AYFSOFT PTE. LTD., Singapore
    """.trimIndent(), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp, lineHeight = 22.sp)
}

@Composable
private fun KvkkContent() {
    Text("Kişisel Verilerin Korunması Kanunu (KVKK) Aydınlatma Metni", color = MaterialTheme.colorScheme.onSurface, fontSize = 18.sp, fontWeight = FontWeight.Bold)
    Divider(color = MaterialTheme.colorScheme.outlineVariant)
    Text("""
VERİ SORUMLUSU:
AYFSOFT PTE. LTD. ve Yusuf Avşar olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla hareket etmekteyiz.

İŞLENEN KİŞİSEL VERİLER:
• Kimlik verisi: Ad, soyadı, profil fotoğrafı (isteğe bağlı)
• İletişim verisi: Telefon numarası (zorunlu)
• Kullanıcı verisi: Mesaj içerikleri, arama kayıtları, durum bilgileri
• Cihaz verisi: IP adresi, cihaz modeli, işletim sistemi sürümü (performans ve güvenlik için)

VERİ İŞLEME AMAÇLARI:
• Hesap oluşturma ve kimlik doğrulama
• Hizmet sunumu ve kalite yönetimi
• Güvenlik ve dolandırıcılık önleme
• Kullanıcı destek taleplerinin yanıtlanması

HUKUKİ SEBEPLER:
KVKK madde 5 uyarınca: sözleşmenin ifası, hukuki yükümlülük, meşru menfaat ve açık rıza.

VERİ AKTARIMI:
Verileriniz, kanuni zorunluluk halleri dışında üçüncü kişilerle paylaşılmaz. Yurt dışına veri aktarımı, KVKK madde 9 kapsamında yeterli korumaya sahip ülkelere veya açık rızanız ile gerçekleştirilir.

HAKLARINIZ (KVKK madde 11):
a) Verilerinizin işlenip işlenmediğini öğrenme
b) İşlenmişse bilgi talep etme
c) İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
d) Yurt içi/yurt dışı aktarıldığı üçüncü kişileri bilme
e) Eksik/yanlış işlenmişse düzeltilmesini isteme
f) KVKK koşulları çerçevesinde silinmesini isteme
g) Aktarılan üçüncü kişilerin bilgilendirilmesini isteme
h) Aleyhinize sonuç doğuran otomatik analiz sonuçlarına itiraz etme
i) Kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme

Başvuru: kvkk@nova.app
    """.trimIndent(), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp, lineHeight = 22.sp)
}

@Composable
private fun CookiesContent() {
    Text("Çerez (Cookie) Politikası", color = MaterialTheme.colorScheme.onSurface, fontSize = 18.sp, fontWeight = FontWeight.Bold)
    Divider(color = MaterialTheme.colorScheme.outlineVariant)
    Text("""
Bu politika, Nova uygulamasında kullanılan çerezler ve benzer teknolojilere ilişkin kullanıcıları bilgilendirmeyi amaçlar.

1. ZORUNLU ÇEREZLER
Bu çerezler, uygulamanın temel işlevlerini yerine getirebilmesi için gereklidir. Oturum yönetimi, güvenlik ve ağ trafiği yönetimi bu çerezler aracılığıyla sağlanır. Devre dışı bırakılmaları durumunda uygulama düzgün çalışmayabilir.
• Oturum çerezleri: Kullanıcı giriş bilgilerini saklar (süre: oturum sonu)
• Güvenlik çerezleri: Hesap güvenliğini sağlar (süre: 24 saat)

2. İŞLEVSEL ÇEREZLER
Kullanıcı tercihlerini hatırlayarak deneyimi kişiselleştirir.
• Dil tercihi çerezi
• Tema tercihi çerezi (süre: 1 yıl)

3. ANALİTİK ÇEREZLER
Uygulama performansını ve kullanım alışkanlıklarını anonim olarak analiz eder. Kişisel veri toplamaz, yalnızca toplu istatistik sağlar.
• Performans izleme çerezi (süre: 1 yıl)

ÇEREZ YÖNETİMİ:
Kullanıcılar, çerez tercihlerini uygulama ayarlarından her zaman değiştirebilir. Zorunlu çerezlerin devre dışı bırakılması, uygulamanın bazı özelliklerinin kullanılamaz hale gelmesine neden olabilir.

Detaylı bilgi ve başvuru için: kvkk@nova.app
    """.trimIndent(), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp, lineHeight = 22.sp)
}
