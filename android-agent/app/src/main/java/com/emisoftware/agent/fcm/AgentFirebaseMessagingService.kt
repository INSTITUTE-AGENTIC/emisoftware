package com.emisoftware.agent.fcm

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import com.emisoftware.agent.admin.MyDeviceAdminReceiver
import com.emisoftware.agent.data.DeviceConfig
import com.emisoftware.agent.lock.LockActivity
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Receives the four commands the backend sends (see src/lib/fcm.ts in the
 * Next.js admin app). Data-only messages — no notification tray entry,
 * since the person affected finds out by the lock screen itself, not a
 * push banner they could swipe away.
 */
class AgentFirebaseMessagingService : FirebaseMessagingService() {

    private val scope = CoroutineScope(Dispatchers.Default)

    override fun onMessageReceived(message: RemoteMessage) {
        when (message.data["command"]) {
            "lock" -> lock(message.data["reason"] ?: "emi_overdue")
            "unlock" -> unlock()
            "wipe" -> wipe()
            "deprovision" -> deprovision()
        }
    }

    override fun onNewToken(token: String) {
        scope.launch {
            val deviceId = DeviceConfig.getDeviceId(applicationContext) ?: return@launch
            // Best-effort; the periodic check-in worker retries this too,
            // so a transient failure here isn't fatal.
            runCatching {
                com.emisoftware.agent.network.ApiClient.reportCheckin(
                    deviceId = deviceId,
                    lat = 0.0,
                    lng = 0.0,
                    fcmToken = token,
                )
            }
        }
    }

    private fun lock(reason: String) {
        scope.launch { DeviceConfig.setLockReason(applicationContext, reason) }
        val intent = Intent(applicationContext, LockActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
    }

    private fun unlock() {
        scope.launch { DeviceConfig.setLockReason(applicationContext, null) }
        LockActivity.finishIfOpen()
    }

    private fun wipe() {
        // Deliberately the most drastic command — the admin panel only
        // sends this for a confirmed stolen/defaulted device, never as a
        // first response to a missed payment (see android-agent/README.md).
        val dpm = dpm() ?: return
        dpm.wipeData(0)
    }

    private fun deprovision() {
        // Fired once every installment is paid — removes this app's
        // Device Owner status and, with it, the app itself, handing the
        // customer back a normal, unmanaged phone.
        unlock()
        val dpm = dpm() ?: return
        if (dpm.isDeviceOwnerApp(packageName)) {
            dpm.clearDeviceOwnerApp(packageName)
        }
    }

    private fun dpm(): DevicePolicyManager? {
        val dpm = getSystemService(DevicePolicyManager::class.java)
        val admin = MyDeviceAdminReceiver.componentName(this)
        return if (dpm.isAdminActive(admin)) dpm else null
    }
}
