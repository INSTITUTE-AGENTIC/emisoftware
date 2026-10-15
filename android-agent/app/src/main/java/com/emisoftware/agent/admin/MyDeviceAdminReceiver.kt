package com.emisoftware.agent.admin

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.UserManager
import com.emisoftware.agent.data.DeviceConfig
import kotlinx.coroutines.runBlocking

/**
 * Registered as the Device Owner's admin component. The provisioning QR
 * code (see android-agent/README.md) carries this device's backend
 * device_id in EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE — we read it here,
 * the moment provisioning finishes, so there's no manual setup step on
 * the phone itself.
 */
class MyDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)

        val extras = intent.getBundleExtra(DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE)
        val deviceId = extras?.getString("device_id")

        if (deviceId != null) {
            runBlocking { DeviceConfig.setDeviceId(context, deviceId) }
        }

        // Whitelist this app for LockTask (kiosk) mode now, while we still
        // have Device Owner setup privileges — startLockTask() later, from
        // the lock screen, would silently no-op without this.
        val dpm = context.getSystemService(DevicePolicyManager::class.java)
        val admin = ComponentName(context, MyDeviceAdminReceiver::class.java)
        dpm.setLockTaskPackages(admin, arrayOf(context.packageName))

        // Anti-tamper hardening — closes every reset/removal path Android's
        // policy API can actually close. See android-agent/README.md
        // ("What a factory reset can and can't do to this app") for the one
        // path it cannot close: a hardware recovery-mode wipe.
        dpm.setUninstallBlocked(admin, context.packageName, true)
        dpm.addUserRestriction(admin, UserManager.DISALLOW_FACTORY_RESET)
        dpm.addUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT)
        dpm.addUserRestriction(admin, UserManager.DISALLOW_DEBUGGING_FEATURES)
        dpm.addUserRestriction(admin, UserManager.DISALLOW_MODIFY_ACCOUNTS)
    }

    companion object {
        fun componentName(context: Context) = ComponentName(context, MyDeviceAdminReceiver::class.java)
    }
}
