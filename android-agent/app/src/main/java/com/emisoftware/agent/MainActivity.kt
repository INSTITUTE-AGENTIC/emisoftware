package com.emisoftware.agent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.emisoftware.agent.data.DeviceConfig
import com.emisoftware.agent.network.ApiClient
import com.emisoftware.agent.network.DeviceStatus
import com.emisoftware.agent.ui.theme.BrandSuccess
import com.emisoftware.agent.ui.theme.EmiLockAgentTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Home screen shown when the device is in good standing. Deliberately
 * plain: this app's job is to be invisible until there's a reason not
 * to be. No branding tricks, no hidden mode — a customer who taps the
 * app icon should see exactly what it's for.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            EmiLockAgentTheme {
                HomeScreen()
            }
        }
    }
}

@Composable
private fun HomeScreen() {
    val context = androidx.compose.ui.platform.LocalContext.current
    var status by remember { mutableStateOf<DeviceStatus?>(null) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        val deviceId = DeviceConfig.getDeviceId(context)
        if (deviceId == null) {
            loadError = "Not provisioned yet"
            loading = false
            return@LaunchedEffect
        }
        try {
            status = withContext(Dispatchers.IO) { ApiClient.fetchStatus(deviceId) }
        } catch (e: Exception) {
            loadError = "Couldn't reach server — showing last known state"
        }
        loading = false
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(48.dp))
            Icon(
                imageVector = Icons.Filled.Shield,
                contentDescription = null,
                tint = BrandSuccess,
                modifier = Modifier.size(72.dp),
            )
            Spacer(Modifier.height(16.dp))
            Text("EMI Protect", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(
                "This device is financed and protected",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(32.dp))

            when {
                loading -> CircularProgressIndicator()
                status != null -> StatusCard(status!!)
                else -> Text(loadError ?: "Unknown state", color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun StatusCard(status: DeviceStatus) {
    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                StatusIcon(status.status)
                Spacer(Modifier.width(8.dp))
                Text(
                    text = when (status.status) {
                        "active" -> "Up to date"
                        "locked" -> "Payment overdue"
                        "paid_off" -> "Fully paid"
                        else -> status.status
                    },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Spacer(Modifier.height(12.dp))
            InfoRow("Customer", status.customerName)
            InfoRow("EMI", "₹${status.emiAmount} × ${status.emiCount}")
            status.shopName?.let { InfoRow("Shop", it) }
        }
    }
}

@Composable
private fun StatusIcon(status: String) {
    val (icon, tint) = when (status) {
        "active", "paid_off" -> Icons.Filled.CheckCircle to BrandSuccess
        else -> Icons.Filled.Shield to MaterialTheme.colorScheme.error
    }
    Icon(imageVector = icon, contentDescription = null, tint = tint)
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontWeight = FontWeight.Medium)
    }
}
