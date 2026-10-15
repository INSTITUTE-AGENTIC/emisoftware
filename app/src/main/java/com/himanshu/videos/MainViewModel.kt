package com.himanshu.videos

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class UiState(
    val creators: List<Creator> = emptyList(),
    val videos: List<Video> = emptyList(),
    val refreshing: Boolean = false,
    val error: String? = null,
)

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val store = Store(app)
    private val _state = MutableStateFlow(UiState(store.creators(), store.cachedFeed()))
    val state = _state.asStateFlow()
    private var refreshJob: Job? = null

    init { refresh() }

    fun reloadCache() {
        _state.update { it.copy(creators = store.creators(), videos = store.cachedFeed()) }
    }

    fun refresh() {
        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            val creators = _state.value.creators
            if (creators.isEmpty()) {
                _state.update { it.copy(refreshing = false, error = null) }
                return@launch
            }
            _state.update { it.copy(refreshing = true, error = null) }
            val results = withContext(Dispatchers.IO) {
                creators.map { c -> async { c.id to runCatching { YouTube.feed(c.id).second }.getOrNull() } }.awaitAll()
            }
            val ok = results.filter { it.second != null }
            val failed = results.filter { it.second == null }.map { it.first }.toSet()
            val fetched = ok.flatMap { it.second!! }
            val ids = creators.map { it.id }.toSet()
            val keep = _state.value.videos.filter { it.channelId in failed && it.channelId in ids }
            val merged = (fetched + keep).distinctBy { it.id }.sortedByDescending { it.published }
            withContext(Dispatchers.IO) {
                store.saveFeed(merged)
                store.saveSeen(store.seen() + fetched.map { it.id })
                store.saveKnown(store.known() + ok.map { it.first })
            }
            _state.update {
                it.copy(
                    videos = merged,
                    refreshing = false,
                    error = if (ok.isEmpty()) "Couldn't reach YouTube. Pull down to retry." else null,
                )
            }
        }
    }

    /** Returns an error message, or null on success. */
    suspend fun addCreator(input: String): String? = try {
        val c = withContext(Dispatchers.IO) { YouTube.resolve(input) }
        if (_state.value.creators.any { it.id == c.id }) {
            "You already follow ${c.name}"
        } else {
            val list = _state.value.creators + c
            withContext(Dispatchers.IO) { store.saveCreators(list) }
            _state.update { it.copy(creators = list) }
            refresh()
            null
        }
    } catch (e: Exception) {
        e.message ?: "Couldn't add that creator"
    }

    fun removeCreator(c: Creator) {
        val list = _state.value.creators.filterNot { it.id == c.id }
        val vids = _state.value.videos.filterNot { it.channelId == c.id }
        _state.update { it.copy(creators = list, videos = vids) }
        viewModelScope.launch(Dispatchers.IO) {
            store.saveCreators(list)
            store.saveFeed(vids)
            store.saveKnown(store.known() - c.id)
        }
    }
}
