package com.emisoftware.agent.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.emisoftware.agent.data.DeviceConfig
import com.emisoftware.agent.lock.LockActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * If the device was locked before it rebooted (or a thief tries a
 * reboot to escape the lock screen), re-show the lock screen on boot
 * rather than trusting the lock to have survived in memory.
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        CoroutineScope(Dispatchers.Default).launch {
            val stillLocked = DeviceConfig.lockReasonFlow(context).first() != null
            if (stillLocked) {
                val lockIntent = Intent(context, LockActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(lockIntent)
            }
        }
    }
}
