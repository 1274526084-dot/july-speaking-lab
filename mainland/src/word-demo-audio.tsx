/* oxlint-disable jsx-a11y/media-has-caption */
import { LoaderCircle, Volume2 } from 'lucide-react';
import { useRef, useState } from 'react';

export function WordDemoAudio({
  urls,
  phrase,
  compact = false,
}: {
  urls: string[];
  phrase: string;
  compact?: boolean;
}) {
  const playable = urls.filter(Boolean);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  if (!playable.length) return null;
  if (playable.length === 1) {
    return (
      <audio
        controls
        preload="metadata"
        src={playable[0]}
        className={compact ? 'mt-3 h-9 w-full' : 'mt-4 w-full'}
      />
    );
  }

  function playFromStart() {
    const audio = audioRef.current;
    if (!audio) return;
    segmentRef.current = 0;
    setError('');
    audio.src = playable[0];
    audio.load();
    setPlaying(true);
    void audio.play().catch(() => {
      setPlaying(false);
      setError('示范发音暂时无法播放，请刷新后重试。');
    });
  }

  function playNextSegment() {
    const next = segmentRef.current + 1;
    if (next >= playable.length) {
      setPlaying(false);
      segmentRef.current = 0;
      return;
    }
    segmentRef.current = next;
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = playable[next];
    audio.load();
    window.setTimeout(() => {
      void audio.play().catch(() => {
        setPlaying(false);
        setError('词组中的一段发音没有加载成功，请重试。');
      });
    }, 110);
  }

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <audio ref={audioRef} preload="metadata" onEnded={playNextSegment} />
      <button
        type="button"
        onClick={playFromStart}
        disabled={playing}
        className="word-secondary w-full justify-center"
      >
        {playing ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
        {playing ? '正在播放词组示范…' : '播放词组示范'}
      </button>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`${phrase} 的逐词示范`}>
        {phrase.split(/\s+/).map((word, index) => (
          <span key={`${word}-${index}`} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
            {index + 1}. {word}
          </span>
        ))}
      </div>
      {error && <p className="word-error mt-2">{error}</p>}
    </div>
  );
}
