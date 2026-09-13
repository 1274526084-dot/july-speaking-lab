export type PronunciationAssessment = {
  acousticScore: number;
  speechDetected: boolean;
  durationMs: number;
  referenceCompared: boolean;
};

type AudioFeatures = {
  speechDetected: boolean;
  durationMs: number;
  quality: number;
  envelope: number[];
  zeroCrossings: number[];
};

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] || 0;
}

function resample(values: number[], count = 40) {
  if (!values.length) return Array.from({ length: count }, () => 0);
  if (values.length === 1) return Array.from({ length: count }, () => values[0]);
  return Array.from({ length: count }, (_, index) => {
    const position = (index / (count - 1)) * (values.length - 1);
    const left = Math.floor(position);
    const right = Math.min(values.length - 1, left + 1);
    const fraction = position - left;
    return values[left] * (1 - fraction) + values[right] * fraction;
  });
}

function extractFeatures(buffer: AudioBuffer): AudioFeatures {
  const frameSize = Math.max(128, Math.round(buffer.sampleRate * 0.02));
  const frameCount = Math.max(1, Math.ceil(buffer.length / frameSize));
  const rmsValues: number[] = [];
  const crossingValues: number[] = [];
  let peak = 0;
  let clipped = 0;
  let totalSamples = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * frameSize;
    const end = Math.min(buffer.length, start + frameSize);
    let sumSquares = 0;
    let crossings = 0;
    let previous = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      let sample = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        sample += buffer.getChannelData(channel)[sampleIndex] || 0;
      }
      sample /= Math.max(1, buffer.numberOfChannels);
      sumSquares += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
      if (Math.abs(sample) >= 0.985) clipped += 1;
      if (sampleIndex > start && Math.sign(sample) !== Math.sign(previous)) crossings += 1;
      previous = sample;
      totalSamples += 1;
    }
    const length = Math.max(1, end - start);
    rmsValues.push(Math.sqrt(sumSquares / length));
    crossingValues.push(crossings / length);
  }

  const noiseFloor = percentile(rmsValues, 0.2);
  const loudestFrame = Math.max(...rmsValues, 0);
  const threshold = Math.max(0.009, noiseFloor * 2.4, loudestFrame * 0.09);
  const activeFrames = rmsValues.map((value, index) => (value >= threshold ? index : -1)).filter((index) => index >= 0);
  const speechDetected = loudestFrame >= 0.014 && activeFrames.length >= 3;
  if (!speechDetected) return { speechDetected: false, durationMs: 0, quality: 0, envelope: [], zeroCrossings: [] };

  const first = Math.max(0, activeFrames[0] - 1);
  const last = Math.min(frameCount - 1, activeFrames[activeFrames.length - 1] + 1);
  const trimmedRms = rmsValues.slice(first, last + 1);
  const trimmedCrossings = crossingValues.slice(first, last + 1);
  const durationMs = Math.round(((last - first + 1) * frameSize * 1000) / buffer.sampleRate);
  const activeRatio = activeFrames.length / Math.max(1, last - first + 1);
  const activeRms = activeFrames.reduce((sum, index) => sum + rmsValues[index], 0) / activeFrames.length;
  const decibels = 20 * Math.log10(Math.max(activeRms, 0.000_001));
  const levelScore = decibels < -36 ? clamp((decibels + 55) / 19) : decibels > -7 ? clamp((1 - peak) / 0.45) : 1;
  const activityScore = clamp((activeRatio - 0.18) / 0.58);
  const clippingPenalty = clamp((clipped / Math.max(1, totalSamples)) * 45);
  const durationQuality = clamp(durationMs / 450) * clamp(7_000 / Math.max(durationMs, 1));
  const quality = clamp(levelScore * 0.48 + activityScore * 0.3 + durationQuality * 0.22 - clippingPenalty * 0.35);
  const envelopeMaximum = Math.max(...trimmedRms, 0.000_001);
  const crossingMaximum = Math.max(percentile(trimmedCrossings, 0.9), 0.01);

  return {
    speechDetected,
    durationMs,
    quality,
    envelope: resample(trimmedRms.map((value) => clamp(value / envelopeMaximum))),
    zeroCrossings: resample(trimmedCrossings.map((value) => clamp(value / crossingMaximum))),
  };
}

function compareFeatures(student: AudioFeatures, reference: AudioFeatures) {
  const envelopeDifference = student.envelope.reduce(
    (sum, value, index) => sum + Math.abs(value - (reference.envelope[index] || 0)),
    0,
  ) / Math.max(1, student.envelope.length);
  const crossingDifference = student.zeroCrossings.reduce(
    (sum, value, index) => sum + Math.abs(value - (reference.zeroCrossings[index] || 0)),
    0,
  ) / Math.max(1, student.zeroCrossings.length);
  const durationRatio = Math.min(student.durationMs, reference.durationMs) / Math.max(student.durationMs, reference.durationMs, 1);
  return clamp((1 - envelopeDifference) * 0.46 + (1 - crossingDifference) * 0.2 + durationRatio * 0.34);
}

async function decodeUrl(url: string, context: AudioContext) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('示范音频加载失败');
  return context.decodeAudioData(await response.arrayBuffer());
}

export async function assessPronunciationRecording(
  recording: Blob,
  referenceUrls: string[],
  target: string,
): Promise<PronunciationAssessment> {
  const AudioContextConstructor = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return { acousticScore: 0, speechDetected: recording.size > 4_000, durationMs: 0, referenceCompared: false };
  }
  const context = new AudioContextConstructor();
  try {
    const studentBuffer = await context.decodeAudioData(await recording.arrayBuffer());
    const student = extractFeatures(studentBuffer);
    if (!student.speechDetected) return { acousticScore: 0, speechDetected: false, durationMs: student.durationMs, referenceCompared: false };

    let referenceCompared = false;
    let similarity = 0;
    try {
      const referenceBuffers = await Promise.all(referenceUrls.filter(Boolean).slice(0, 12).map((url) => decodeUrl(url, context)));
      const referenceFeatures = referenceBuffers.map(extractFeatures).filter((features) => features.speechDetected);
      if (referenceFeatures.length) {
        const combinedReference: AudioFeatures = {
          speechDetected: true,
          durationMs: referenceFeatures.reduce((sum, features) => sum + features.durationMs, 0),
          quality: referenceFeatures.reduce((sum, features) => sum + features.quality, 0) / referenceFeatures.length,
          envelope: resample(referenceFeatures.flatMap((features) => features.envelope)),
          zeroCrossings: resample(referenceFeatures.flatMap((features) => features.zeroCrossings)),
        };
        similarity = compareFeatures(student, combinedReference);
        referenceCompared = true;
      }
    } catch {
      // Recording-quality scoring remains available when a signed reference URL expires mid-practice.
    }

    const expectedDuration = clamp(target.trim().split(/\s+/).length * 650 + target.length * 28, 500, 6_000);
    const expectedDurationMatch = Math.min(student.durationMs, expectedDuration) / Math.max(student.durationMs, expectedDuration, 1);
    const score = referenceCompared
      ? 46 + student.quality * 20 + similarity * 27
      : 48 + student.quality * 25 + expectedDurationMatch * 13;
    return {
      acousticScore: Math.round(clamp(score, 35, referenceCompared ? 93 : 86)),
      speechDetected: true,
      durationMs: student.durationMs,
      referenceCompared,
    };
  } catch {
    return { acousticScore: 0, speechDetected: false, durationMs: 0, referenceCompared: false };
  } finally {
    await context.close().catch(() => undefined);
  }
}
