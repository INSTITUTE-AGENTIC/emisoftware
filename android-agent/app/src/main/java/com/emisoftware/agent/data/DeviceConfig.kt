package com.emisoftware.agent.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "agent_config")

/**
 * The one thing this app needs to know that isn't baked into the build:
 * which backend device row it is. Set once, right after provisioning —
 * either pushed in via the QR provisioning extras bundle
 * (EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE, read in MyDeviceAdminReceiver)
 * or typed in manually on first launch as a fallback.
 */
object DeviceConfig {
    private val DEVICE_ID = stringPreferencesKey("device_id")
    private val LOCK_REASON = stringPreferencesKey("lock_reason")

    fun deviceIdFlow(context: Context): Flow<String?> =
        context.dataStore.data.map { it[DEVICE_ID] }

    suspend fun getDeviceId(context: Context): String? =
        context.dataStore.data.first()[DEVICE_ID]

    suspend fun setDeviceId(context: Context, deviceId: String) {
        context.dataStore.edit { it[DEVICE_ID] = deviceId }
    }

    suspend fun setLockReason(context: Context, reason: String?) {
        context.dataStore.edit {
            if (reason == null) it.remove(LOCK_REASON) else it[LOCK_REASON] = reason
        }
    }

    fun lockReasonFlow(context: Context): Flow<String?> =
        context.dataStore.data.map { it[LOCK_REASON] }
}
