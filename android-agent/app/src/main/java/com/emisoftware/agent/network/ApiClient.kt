package com.emisoftware.agent.network

import com.emisoftware.agent.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

data class DeviceStatus(
    val status: String,
    val customerName: String,
    val emiAmount: Double,
    val emiCount: Int,
    val shopName: String?,
    val shopPhone: String?,
    val nextPaymentLinkUrl: String?,
)

/**
 * Thin client for the handful of backend endpoints this device-side
 * app needs. No user auth — every call carries the shared device API
 * key configured at build time (see app/build.gradle.kts).
 */
object ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun baseRequest(path: String): Request.Builder =
        Request.Builder()
            .url("${BuildConfig.API_BASE_URL}$path")
            .addHeader("X-Device-Api-Key", BuildConfig.DEVICE_API_KEY)

    @Throws(IOException::class)
    fun fetchStatus(deviceId: String): DeviceStatus {
        val request = baseRequest("/api/devices/$deviceId/status").get().build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("status ${response.code}")
            val body = JSONObject(response.body?.string().orEmpty())
            val next = body.optJSONObject("next_installment")
            return DeviceStatus(
                status = body.getString("status"),
                customerName = body.optString("customer_name"),
                emiAmount = body.optDouble("emi_amount", 0.0),
                emiCount = body.optInt("emi_count", 0),
                shopName = body.optString("shop_name", null),
                shopPhone = body.optString("shop_phone", null),
                nextPaymentLinkUrl = next?.optString("razorpay_payment_link_url", null),
            )
        }
    }

    @Throws(IOException::class)
    fun reportCheckin(deviceId: String, lat: Double, lng: Double, fcmToken: String?) {
        val json = JSONObject().apply {
            put("lat", lat)
            put("lng", lng)
            if (fcmToken != null) put("fcm_token", fcmToken)
        }
        val request = baseRequest("/api/devices/$deviceId/location")
            .post(json.toString().toRequestBody(jsonMediaType))
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("checkin ${response.code}")
        }
    }
}
