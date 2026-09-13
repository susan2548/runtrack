package com.runtrackerapp.routereplay

import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PointF
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File
import java.util.Locale
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

class RouteReplayModule : Module() {
  private data class GeoPoint(val latitude: Double, val longitude: Double)

  override fun definition() = ModuleDefinition {
    Name("RouteReplay")

    AsyncFunction("createAndShareReplay") { payload: String ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable")
      val file = createVideo(context.cacheDir, payload)
      val uri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.route-replay-files",
        file
      )
      val shareIntent = Intent(Intent.ACTION_SEND).apply {
        type = "video/mp4"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(shareIntent, "Share Route Replay").apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(chooser)
      uri.toString()
    }
  }

  private fun createVideo(cacheDir: File, payload: String): File {
    val json = JSONObject(payload)
    val sourcePoints = json.getJSONArray("points")
    val points = buildList {
      for (index in 0 until sourcePoints.length()) {
        val point = sourcePoints.getJSONObject(index)
        add(GeoPoint(point.getDouble("latitude"), point.getDouble("longitude")))
      }
    }
    require(points.size >= 2) { "At least two GPS points are required" }

    val outputDir = File(cacheDir, "route-replays").apply { mkdirs() }
    outputDir.listFiles()?.filter { it.extension == "mp4" }?.forEach { it.delete() }
    val safeId = json.optString("id", "activity").replace(Regex("[^A-Za-z0-9_-]"), "-")
    val output = File(outputDir, "runtracker-$safeId.mp4")

    val width = 720
    val height = 720
    val fps = 20
    val frameCount = fps * 15
    val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, 4_000_000)
      setInteger(MediaFormat.KEY_FRAME_RATE, fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    val inputSurface = codec.createInputSurface()
    val muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    val projected = projectRoute(points, width, height)
    val bufferInfo = MediaCodec.BufferInfo()
    var trackIndex = -1
    var muxerStarted = false
    var reachedEnd = false

    fun drain(endOfStream: Boolean) {
      var idlePasses = 0
      while (!reachedEnd && idlePasses < if (endOfStream) 100 else 1) {
        val outputIndex = codec.dequeueOutputBuffer(bufferInfo, if (endOfStream) 10_000 else 0)
        when {
          outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> idlePasses += 1
          outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            check(!muxerStarted) { "Video format changed twice" }
            trackIndex = muxer.addTrack(codec.outputFormat)
            muxer.start()
            muxerStarted = true
          }
          outputIndex >= 0 -> {
            val encodedData = codec.getOutputBuffer(outputIndex)
              ?: throw IllegalStateException("Video encoder returned an empty buffer")
            if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) bufferInfo.size = 0
            if (bufferInfo.size > 0) {
              check(muxerStarted) { "Video track did not start" }
              encodedData.position(bufferInfo.offset)
              encodedData.limit(bufferInfo.offset + bufferInfo.size)
              muxer.writeSampleData(trackIndex, encodedData, bufferInfo)
            }
            reachedEnd = (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
            codec.releaseOutputBuffer(outputIndex, false)
            idlePasses = 0
          }
        }
      }
    }

    try {
      codec.start()
      val startedAt = System.nanoTime()
      for (frame in 0 until frameCount) {
        val progress = frame.toFloat() / (frameCount - 1).toFloat()
        val canvas = inputSurface.lockCanvas(null)
        try {
          drawFrame(
            canvas = canvas,
            route = projected,
            progress = progress,
            title = json.optString("title", "Route Replay"),
            distanceMeters = json.optDouble("distanceMeters", 0.0),
            durationMs = json.optLong("durationMs", 0L)
          )
        } finally {
          inputSurface.unlockCanvasAndPost(canvas)
        }
        drain(false)

        val target = startedAt + ((frame + 1L) * 1_000_000_000L / fps)
        val remainingNanos = target - System.nanoTime()
        if (remainingNanos > 0) {
          Thread.sleep(remainingNanos / 1_000_000L, (remainingNanos % 1_000_000L).toInt())
        }
      }
      codec.signalEndOfInputStream()
      drain(true)
      check(reachedEnd && muxerStarted) { "Video encoder did not finish" }
    } finally {
      inputSurface.release()
      runCatching { codec.stop() }
      codec.release()
      if (muxerStarted) runCatching { muxer.stop() }
      muxer.release()
    }
    return output
  }

  private fun projectRoute(points: List<GeoPoint>, width: Int, height: Int): List<PointF> {
    val meanLatitude = points.map { it.latitude }.average() * Math.PI / 180.0
    val raw = points.map { PointF((it.longitude * cos(meanLatitude)).toFloat(), (-it.latitude).toFloat()) }
    val minX = raw.minOf { it.x }
    val maxX = raw.maxOf { it.x }
    val minY = raw.minOf { it.y }
    val maxY = raw.maxOf { it.y }
    val spanX = max(0.000001f, maxX - minX)
    val spanY = max(0.000001f, maxY - minY)
    val targetLeft = 70f
    val targetTop = 150f
    val targetWidth = width - 140f
    val targetHeight = height - 300f
    val scale = min(targetWidth / spanX, targetHeight / spanY)
    val drawnWidth = spanX * scale
    val drawnHeight = spanY * scale
    val offsetX = targetLeft + (targetWidth - drawnWidth) / 2f
    val offsetY = targetTop + (targetHeight - drawnHeight) / 2f
    return raw.map { PointF(offsetX + (it.x - minX) * scale, offsetY + (it.y - minY) * scale) }
  }

  private fun drawFrame(
    canvas: Canvas,
    route: List<PointF>,
    progress: Float,
    title: String,
    distanceMeters: Double,
    durationMs: Long
  ) {
    canvas.drawColor(Color.rgb(7, 10, 9))
    val muted = Color.rgb(164, 174, 168)
    val white = Color.rgb(243, 247, 244)
    val green = Color.rgb(83, 242, 129)
    val orange = Color.rgb(255, 154, 90)

    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = white
      textSize = 38f
      typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
    }
    val clippedTitle = if (title.length > 26) "${title.take(25)}…" else title
    canvas.drawText(clippedTitle, 54f, 70f, textPaint)
    textPaint.color = green
    textPaint.textSize = 18f
    canvas.drawText("RUNTRACKER · 15S ROUTE REPLAY", 56f, 105f, textPaint)

    val fullPath = Path().apply {
      moveTo(route.first().x, route.first().y)
      route.drop(1).forEach { lineTo(it.x, it.y) }
    }
    val routePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = 12f
      strokeCap = Paint.Cap.ROUND
      strokeJoin = Paint.Join.ROUND
      color = Color.argb(65, 243, 247, 244)
    }
    canvas.drawPath(fullPath, routePaint)

    val exactIndex = progress * (route.size - 1)
    val index = min(route.size - 2, floor(exactIndex).toInt())
    val fraction = exactIndex - index
    val current = PointF(
      route[index].x + (route[index + 1].x - route[index].x) * fraction,
      route[index].y + (route[index + 1].y - route[index].y) * fraction
    )
    val traveled = Path().apply {
      moveTo(route.first().x, route.first().y)
      for (pointIndex in 1..index) lineTo(route[pointIndex].x, route[pointIndex].y)
      lineTo(current.x, current.y)
    }
    routePaint.color = green
    routePaint.strokeWidth = 9f
    canvas.drawPath(traveled, routePaint)

    val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    markerPaint.color = orange
    canvas.drawCircle(route.first().x, route.first().y, 13f, markerPaint)
    markerPaint.color = green
    canvas.drawCircle(route.last().x, route.last().y, 13f, markerPaint)
    markerPaint.color = Color.argb(70, 83, 242, 129)
    canvas.drawCircle(current.x, current.y, 25f, markerPaint)
    markerPaint.color = white
    canvas.drawCircle(current.x, current.y, 10f, markerPaint)

    textPaint.color = muted
    textPaint.textSize = 17f
    canvas.drawText("DISTANCE", 56f, 617f, textPaint)
    canvas.drawText("MOVING TIME", 385f, 617f, textPaint)
    textPaint.color = white
    textPaint.textSize = 32f
    canvas.drawText(String.format(Locale.US, "%.2f KM", distanceMeters / 1000.0), 56f, 663f, textPaint)
    canvas.drawText(formatDuration(durationMs), 385f, 663f, textPaint)
  }

  private fun formatDuration(durationMs: Long): String {
    val totalSeconds = max(0L, durationMs / 1000L)
    val hours = totalSeconds / 3600L
    val minutes = (totalSeconds % 3600L) / 60L
    val seconds = totalSeconds % 60L
    return String.format(Locale.US, "%02d:%02d:%02d", hours, minutes, seconds)
  }
}
