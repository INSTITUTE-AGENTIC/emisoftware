# Keep DeviceAdminReceiver and FCM service — reflectively instantiated by the OS.
-keep class com.emisoftware.agent.admin.** { *; }
-keep class com.emisoftware.agent.fcm.** { *; }
-keep class com.emisoftware.agent.boot.** { *; }
