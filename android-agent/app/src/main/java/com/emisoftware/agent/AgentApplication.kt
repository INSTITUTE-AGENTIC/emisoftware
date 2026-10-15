package com.emisoftware.agent

import android.app.Application
import com.emisoftware.agent.work.LocationCheckinWorker

class AgentApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Idempotent: WorkManager dedupes by unique name, so this is safe
        // to call on every process start (app launch, boot, FCM wake-up).
        LocationCheckinWorker.schedulePeriodic(this)
    }
}
