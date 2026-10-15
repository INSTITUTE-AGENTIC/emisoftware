package com.emisoftware.agent.lock

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Payment
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.emisoftware.agent.admin.MyDeviceAdminReceiver
import com.emisoftware.agent.data.DeviceConfig
import com.emisoftware.agent.network.ApiClient
import com.emisoftware.agent.network.DeviceStatus
import com.emisoftware.agent.ui.theme.BrandDanger
import com.emisoftware.agent.ui.theme.EmiLockAgentTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.lang.ref.WeakReference

/**
 * Full-screen, non-dismissable lock shown while an installment is
 * overdue. Enters Android's LockTask (kiosk) mode so Home/Recents/Back
 * can't get the customer out of it — the only ways out are paying
 * (which triggers the backend's "unlock" push) or the shop's manual
 * override, never a button on this screen itself.
 *
 * What this screen deliberately does NOT do: pretend to be a system
 * error, hide why the phone is locked, or omit how to fix it. The
 * whole point is the customer can always see exactly what's wrong and
 * exactly who to call.
 */
class LockActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = WeakReference(this)
        enterLockTaskIfPossible()

        setContent {
            EmiLockAgentTheme {
                LockScreen(
                    onCallShop = { phone -> dialShop(phone) },
                    onPayNow = { url -> openPaymentLink(url) },
                )
            }
        }
    }

    override fun onBackPressed() {
        // Swallow back — LockTask mode already blocks it, but this is a
        // deliberate second line of defense if LockTask failed to engage
        // (e.g. this app isn't Device Owner yet on an older provisioning).
    }

    private fun enterLockTaskIfPossible() {
        val dpm = getSystemService(DevicePolicyManager::class.java)
        val admin = MyDeviceAdminReceiver.componentName(this)
        if (dpm.isDeviceOwnerApp(packageName) || dpm.isAdminActive(admin)) {
            runCatching { startLockTask() }
        }
    }

    private fun dialShop(phone: String) {
        startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
    }

    private fun openPaymentLink(url: String) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    companion object {
        private var instance: WeakReference<LockActivity>? = null

        /** Called by the FCM service when an "unlock" command arrives. */
        fun finishIfOpen() {
            val activity = instance?.get() ?: return
            activity.runOnUiThread {
                runCatching { activity.stopLockTask() }
                activity.finish()
            }
        }
    }
}

@Composable
private fun LockScreen(onCallShop: (String) -> Unit, onPayNow: (String) -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var status by remember { mutableStateOf<DeviceStatus?>(null) }
    var refreshing by remember { mutableStateOf(false) }

    suspend fun refresh() {
        val deviceId = DeviceConfig.getDeviceId(context) ?: return
        status = runCatching { withContext(Dispatchers.IO) { ApiClient.fetchStatus(deviceId) } }.getOrNull()
    }

    LaunchedEffect(Unit) { refresh() }

    Surface(modifier = Modifier.fillMaxSize(), color = BrandDanger) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.Lock,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(80.dp),
            )
            Spacer(Modifier.height(24.dp))
            Text(
                "Payment Overdue",
                color = Color.White,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "This phone is financed on EMI and is locked until the overdue installment is paid.",
                color = Color.White.copy(alpha = 0.9f),
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(32.dp))

            ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    status?.let { s ->
                        Text("Amount due: ₹${s.emiAmount}", style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(16.dp))

                        if (s.nextPaymentLinkUrl != null) {
                            Button(
                                onClick = { onPayNow(s.nextPaymentLinkUrl) },
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Icon(Icons.Filled.Payment, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("Pay now")
                            }
                            Spacer(Modifier.height(12.dp))
                        }

                        if (s.shopPhone != null) {
                            OutlinedButton(
                                onClick = { onCallShop(s.shopPhone) },
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Icon(Icons.Filled.Call, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("Call ${s.shopName ?: "shop"}")
                            }
                        }
                    } ?: Text("Loading details…")

                    Spacer(Modifier.height(12.dp))
                    TextButton(
                        onClick = {
                            refreshing = true
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Filled.Refresh, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (refreshing) "Checking…" else "I've paid — recheck")
                    }
                }
            }
        }
    }

    LaunchedEffect(refreshing) {
        if (refreshing) {
            refresh()
            // The real unlock comes from the backend's FCM push once the
            // webhook sees the payment — this just re-reads status in case
            // the customer paid and the push is still a few seconds out.
            refreshing = false
        }
    }
}
