// LinaVoiceClient.swift — reference client for the Lina voice engine (ws://127.0.0.1:8765).
//
// The app owns audio I/O: AVAudioEngine with voice processing (Apple's echo canceller) captures the
// mic, resamples to 16 kHz mono Int16 and streams it to /audio; TTS PCM (24 kHz Int16) comes back and
// is scheduled on an AVAudioPlayerNode on the same engine, so the canceller sees the reference signal.
// {"type":"stop"} flushes playback immediately (barge-in). Events arrive on /events as JSON.
//
// NOT compiled or run in the environment where it was written (no macOS). Review before use.

import AVFoundation
import Foundation

final class LinaVoiceClient: NSObject {
    private let base = URL(string: "ws://127.0.0.1:8765")!
    private var audioTask: URLSessionWebSocketTask?
    private var eventsTask: URLSessionWebSocketTask?
    private let session = URLSession(configuration: .default)

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let outFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 24_000, channels: 1, interleaved: false)!
    private var converter: AVAudioConverter?
    var onEvent: (([String: Any]) -> Void)?

    // MARK: lifecycle
    func start() throws {
        let input = engine.inputNode
        try input.setVoiceProcessingEnabled(true)           // AEC + noise suppression (macOS 10.15+)
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: outFormat)

        let inFormat = input.outputFormat(forBus: 0)
        let target = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16_000, channels: 1, interleaved: true)!
        converter = AVAudioConverter(from: inFormat, to: target)

        input.installTap(onBus: 0, bufferSize: 1024, format: inFormat) { [weak self] buffer, _ in
            self?.sendMic(buffer: buffer, target: target)
        }
        try engine.start()
        player.play()

        audioTask = session.webSocketTask(with: base.appendingPathComponent("audio"))
        eventsTask = session.webSocketTask(with: base.appendingPathComponent("events"))
        audioTask?.resume(); eventsTask?.resume()
        receiveAudio(); receiveEvents()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        audioTask?.cancel(with: .goingAway, reason: nil)
        eventsTask?.cancel(with: .goingAway, reason: nil)
    }

    // MARK: control
    func interrupt() { send(json: ["type": "interrupt"], on: eventsTask) }
    func submitText(_ text: String) { send(json: ["type": "text", "text": text], on: eventsTask) }
    func say(_ text: String) { send(json: ["type": "say", "text": text], on: eventsTask) }

    // MARK: mic → engine
    private func sendMic(buffer: AVAudioPCMBuffer, target: AVAudioFormat) {
        guard let converter else { return }
        let ratio = target.sampleRate / buffer.format.sampleRate
        let out = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 16)!
        var err: NSError?
        var consumed = false
        converter.convert(to: out, error: &err) { _, status in
            if consumed { status.pointee = .noDataNow; return nil }
            consumed = true; status.pointee = .haveData; return buffer
        }
        guard err == nil, out.frameLength > 0, let ch = out.int16ChannelData else { return }
        let data = Data(bytes: ch[0], count: Int(out.frameLength) * MemoryLayout<Int16>.size)
        audioTask?.send(.data(data)) { _ in }
    }

    // MARK: engine → speaker
    private func receiveAudio() {
        audioTask?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(.data(let pcm)): self.schedule(pcm16: pcm)
            case .success(.string(let s)):
                if s.contains("\"stop\"") { self.player.stop(); self.player.play() }   // flush queued buffers
            default: break
            }
            self.receiveAudio()
        }
    }

    private func schedule(pcm16: Data) {
        let frames = pcm16.count / 2
        guard frames > 0, let buf = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: AVAudioFrameCount(frames)) else { return }
        buf.frameLength = AVAudioFrameCount(frames)
        pcm16.withUnsafeBytes { raw in
            let src = raw.bindMemory(to: Int16.self)
            let dst = buf.floatChannelData![0]
            for i in 0..<frames { dst[i] = Float(src[i]) / 32768.0 }
        }
        player.scheduleBuffer(buf, completionHandler: nil)
    }

    // MARK: events
    private func receiveEvents() {
        eventsTask?.receive { [weak self] result in
            guard let self else { return }
            if case .success(.string(let s)) = result,
               let data = s.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                self.onEvent?(obj)        // e.g. "state", "transcript", "sentence", "barge_in", "reply_done"
            }
            self.receiveEvents()
        }
    }

    private func send(json: [String: Any], on task: URLSessionWebSocketTask?) {
        guard let data = try? JSONSerialization.data(withJSONObject: json), let s = String(data: data, encoding: .utf8) else { return }
        task?.send(.string(s)) { _ in }
    }
}
