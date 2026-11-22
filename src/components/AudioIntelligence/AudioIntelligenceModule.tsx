import React from 'react';
import { AudioWaveform, Mic, Play, FileAudio, Activity } from 'lucide-react';

export const AudioIntelligenceModule: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#080808] text-[#F5F4F1] font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#303030] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold font-mono tracking-tight text-[#F5F4F1]">
              AUDIO INTELLIGENCE
            </h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#191919] text-[#987654] border border-[#303030]">
              WHISPER LARGE V3
            </span>
          </div>
          <p className="text-xs text-[#9C9C9C] mt-1">
            Local acoustic modeling, real-time transcription, and speaker diarisation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-2">
          <div className="text-xs font-mono uppercase text-[#9C9C9C]">Acoustic Processing</div>
          <div className="text-2xl font-bold font-mono text-[#F5F4F1]">16.4x</div>
          <div className="text-[11px] text-[#987654] font-mono">Real-time inference ratio</div>
        </div>
        <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-2">
          <div className="text-xs font-mono uppercase text-[#9C9C9C]">Word Error Rate (WER)</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">1.8%</div>
          <div className="text-[11px] text-[#9C9C9C] font-mono">Zero hallucination threshold</div>
        </div>
        <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-2">
          <div className="text-xs font-mono uppercase text-[#9C9C9C]">Active Pipeline</div>
          <div className="text-2xl font-bold font-mono text-[#F5F4F1]">FP16</div>
          <div className="text-[11px] text-[#987654] font-mono">CUDA accelerated pipeline</div>
        </div>
      </div>

      <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3">
        <h2 className="text-xs font-mono uppercase text-[#9C9C9C] font-semibold">
          Recent Audio Transcriptions
        </h2>
        <div className="space-y-2 font-mono text-xs">
          {[
            { title: 'executive_board_briefing_session_04.wav', duration: '48m 12s', speakers: 4, wer: '1.4%' },
            { title: 'engineering_architecture_deep_dive.m4a', duration: '1h 14m', speakers: 3, wer: '1.9%' }
          ].map(aud => (
            <div key={aud.title} className="p-3 rounded bg-[#080808] border border-[#262626] flex items-center justify-between">
              <div className="flex items-center space-x-2.5 truncate">
                <FileAudio className="w-4 h-4 text-[#987654] shrink-0" />
                <span className="text-[#F5F4F1] truncate">{aud.title}</span>
                <span className="text-[11px] text-[#9C9C9C]">({aud.duration})</span>
              </div>
              <div className="flex items-center space-x-4 text-[11px] text-[#9C9C9C] shrink-0">
                <span className="text-[#987654]">{aud.speakers} speakers</span>
                <span>WER {aud.wer}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
