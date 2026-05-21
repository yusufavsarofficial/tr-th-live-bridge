package com.pingle.i18n

import android.content.Context

class LocaleHelper(context: Context) {
    private val prefs = context.getSharedPreferences("pingle_locale", Context.MODE_PRIVATE)

    fun getLanguage(): PingleLanguage {
        val code = prefs.getString("lang", "en") ?: "en"
        return when (code) {
            "tr" -> PingleLanguage.TURKISH
            "th" -> PingleLanguage.THAI
            "ru" -> PingleLanguage.RUSSIAN
            "zh" -> PingleLanguage.CHINESE
            else -> PingleLanguage.ENGLISH
        }
    }

    fun setLanguage(lang: PingleLanguage) {
        val code = when (lang) {
            PingleLanguage.TURKISH -> "tr"
            PingleLanguage.THAI -> "th"
            PingleLanguage.RUSSIAN -> "ru"
            PingleLanguage.CHINESE -> "zh"
            else -> "en"
        }
        prefs.edit().putString("lang", code).apply()
    }
}
