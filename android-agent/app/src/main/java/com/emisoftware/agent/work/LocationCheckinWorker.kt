package com.emisoftware.agent.work

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.work.*
import com.emisoftware.agent.data.DeviceConfig
import com.emisoftware.agent.network.ApiClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.TimeUnit

/**
 * Periodic location + FCM-token check-in. Runs every ~4 hours regardless
 * of app state — this is what makes the "last seen" column in the admin
 * panel mean something, and what re-links a device to its FCM token
 * after the OS rotates it.
 *
 * Reports only what the signed consent form discloses (approximate
 * location + lock status, nothing else) — see the warning in
 * src/app/api/devices/[id]/location/route.ts on the backend.
 */
class LocationCheckinWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val deviceId = DeviceConfig.getDeviceId(applicationContext) ?: return Result.success()

        val hasLocationPermission = ContextCompat.checkSelfPermission(
            applicationContext, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val location = if (hasLocationPermission) fetchLocation() else null
        val token = runCatching { FirebaseMessaging.getInstance().token.await() }.getOrNull()

        return try {
            ApiClient.reportCheckin(
                deviceId = deviceId,
                lat = location?.latitude ?: 0.0,
                lng = location?.longitude ?: 0.0,
                fcmToken = token,
            )
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private suspend fun fetchLocation() = runCatching {
        val client = LocationServices.getFusedLocationProviderClient(applicationContext)
        withTimeoutOrNull(20_000) {
            client.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null).await()
        }
    }.getOrNull()

    companion object {
        private const val UNIQUE_WORK_NAME = "device_checkin"

        fun schedulePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<LocationCheckinWorker>(4, TimeUnit.HOURS)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }
    }
}
