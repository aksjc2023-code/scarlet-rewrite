import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MultiTrackTimelineState,
  BRollClip,
  TitleClip,
  recalculateAnchoredTimestamps,
  insertBRollOnKeywordSelection,
  insertTitleOnKeywordSelection,
  buildFFmpegMultiTrackArgs,
  cleanseAudioWaveform,
  segmentSpeechAndIdentifySilences,
  generateDisfluencyEdl,
  executeAudioEnhancementWorkflow,
  classifyFdtDisfluencies,
  BioTag,
  asSourceSeconds,
  WordToken,
} from '../src/index';

test('1. recalculateAnchoredTimestamps dynamically shifts B-Roll and Titles across pruned words', () => {
  const initialState: MultiTrackTimelineState = {
    tracks: {
      aRollTrackId: 'track_aroll',
      bRollTracks: ['track_broll_1'],
      titleTracks: ['track_title_1'],
      audioTracks: ['track_audio_1'],
    },
    transcriptWords: [
      { id: 'w1', word: 'Hello', start: 0.0, end: 1.0, isFiller: false, isDeleted: false },
      { id: 'w2', word: 'um', start: 1.0, end: 2.0, isFiller: true, isDeleted: false }, // Will be pruned
      { id: 'w3', word: 'world', start: 2.0, end: 3.5, isFiller: false, isDeleted: false },
      { id: 'w4', word: 'today', start: 3.5, end: 4.5, isFiller: false, isDeleted: false },
    ],
    bRollClips: {
      b1: {
        id: 'b1',
        trackId: 'track_broll_1',
        trackType: 'B_ROLL',
        anchorWordIdStart: 'w3',
        anchorWordIdEnd: 'w4',
        timelineStart: 2.0,
        timelineEnd: 4.5,
        sourceUrl: 'blob:mock',
        sourceStart: 0,
        sourceEnd: 2.5,
        transform: { x: 0, y: 0, width: 1, height: 1, opacity: 1, fit: 'cover' },
      },
    },
    titleClips: {
      t1: {
        id: 't1',
        trackId: 'track_title_1',
        trackType: 'TITLE',
        anchorWordIdStart: 'w3',
        anchorWordIdEnd: 'w3',
        timelineStart: 2.0,
        timelineEnd: 3.5,
        text: 'World Title',
        style: {
          fontFamily: 'Inter',
          fontSize: 32,
          color: '#FFF',
          position: 'lower_third',
          animation: 'fade_pop',
        },
      },
    },
    audioConfigs: {},
  };

  // Before pruning: w3 starts at 2.0, w4 ends at 4.5
  const before = recalculateAnchoredTimestamps(initialState);
  assert.equal(before.bRolls.b1?.timelineStart, 2.0);
  assert.equal(before.bRolls.b1?.timelineEnd, 4.5);

  // Prune filler 'um' (w2)
  const stateWithPrunedFiller: MultiTrackTimelineState = {
    ...initialState,
    transcriptWords: initialState.transcriptWords.map(w =>
      w.id === 'w2' ? { ...w, isDeleted: true } : w
    ),
  };

  const after = recalculateAnchoredTimestamps(stateWithPrunedFiller);
  // w1 duration is 1.0. With w2 deleted, w3 dynamically begins at 1.0 and ends at 2.5!
  assert.equal(after.bRolls.b1?.timelineStart, 1.0);
  assert.equal(after.bRolls.b1?.timelineEnd, 3.5);
  assert.equal(after.titles.t1?.timelineStart, 1.0);
  assert.equal(after.titles.t1?.timelineEnd, 2.5);
});

test('2. insertBRollOnKeywordSelection & insertTitleOnKeywordSelection bind to word boundaries', () => {
  const state: MultiTrackTimelineState = {
    tracks: { aRollTrackId: 'aroll', bRollTracks: ['track_broll_1'], titleTracks: ['track_title_1'], audioTracks: [] },
    transcriptWords: [
      { id: 'tok_1', word: 'Amazing', start: 5.0, end: 5.8, isFiller: false, isDeleted: false },
      { id: 'tok_2', word: 'Demo', start: 5.8, end: 6.4, isFiller: false, isDeleted: false },
    ],
    bRollClips: {},
    titleClips: {},
    audioConfigs: {},
  };

  const mockFile = new Blob(['video-pcm'], { type: 'video/mp4' });
  const broll = insertBRollOnKeywordSelection(['tok_1', 'tok_2'], mockFile, 10.0, state);
  assert.equal(broll.anchorWordIdStart, 'tok_1');
  assert.equal(broll.anchorWordIdEnd, 'tok_2');
  assert.equal(broll.timelineStart, 5.0);
  assert.equal(broll.timelineEnd, 6.4);
  assert.equal(broll.trackType, 'B_ROLL');

  const title = insertTitleOnKeywordSelection(['tok_1'], 'Spectacular', state);
  assert.equal(title.anchorWordIdStart, 'tok_1');
  assert.equal(title.text, 'Spectacular');
  assert.equal(title.timelineStart, 5.0);
  assert.equal(title.trackType, 'TITLE');
});

test('3. buildFFmpegMultiTrackArgs builds valid complex filtergraph with overlays, titles, and audio ducking', () => {
  const bRolls: BRollClip[] = [
    {
      id: 'b1',
      trackId: 'track_broll_1',
      trackType: 'B_ROLL',
      timelineStart: 1.5,
      timelineEnd: 4.2,
      sourceUrl: 'broll.mp4',
      sourceStart: 0,
      sourceEnd: 2.7,
      transform: { x: 0.1, y: 0.1, width: 0.4, height: 0.4, opacity: 1, fit: 'pip' },
    },
  ];

  const titles: TitleClip[] = [
    {
      id: 't1',
      trackId: 'track_title_1',
      trackType: 'TITLE',
      timelineStart: 0.5,
      timelineEnd: 2.0,
      text: 'Lower Third Headline',
      style: {
        fontFamily: 'Inter',
        fontSize: 48,
        color: 'yellow',
        backgroundColor: 'black',
        position: 'lower_third',
        animation: 'none',
      },
    },
  ];

  const args = buildFFmpegMultiTrackArgs({
    aRollDuration: 10.0,
    bRolls,
    titles,
    bgAudio: {
      id: 'bgm',
      sourceUrl: 'music.mp3',
      baseVolume: 0.7,
      duckedVolume: 0.15,
      rampUpTime: 0.25,
      rampDownTime: 0.4,
      duckOnSpeech: true,
    },
  });

  const fullCommand = args.join(' ');
  assert.ok(fullCommand.includes('-i aroll_trimmed.mp4'));
  assert.ok(fullCommand.includes('-i broll_0.mp4'));
  assert.ok(fullCommand.includes('-i bg_music.mp3'));
  assert.ok(fullCommand.includes('-filter_complex'));
  assert.ok(fullCommand.includes("between(t,1.500,4.200)"));
  assert.ok(fullCommand.includes("drawtext=text='Lower Third Headline'"));
  assert.ok(fullCommand.includes('sidechaincompress'));
  assert.ok(fullCommand.includes('amix=inputs=2'));
  assert.ok(fullCommand.includes('final_export.mp4'));
});

test('4. cleanseAudioWaveform & segmentSpeechAndIdentifySilences detect silence spans', () => {
  // Generate 2 seconds of 16kHz audio: 0-0.5s tone, 0.5-1.8s silence (1.3s > 1.0s threshold), 1.8-2.0s tone
  const sampleRate = 16000;
  const pcm = new Float32Array(sampleRate * 2);

  for (let i = 0; i < sampleRate * 0.5; i++) {
    pcm[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
  }
  // 0.5s to 1.8s is silence (all 0.0)
  for (let i = Math.floor(sampleRate * 1.8); i < sampleRate * 2; i++) {
    pcm[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
  }

  const cleaned = cleanseAudioWaveform(pcm, sampleRate);
  assert.equal(cleaned.length, pcm.length);

  const silences = segmentSpeechAndIdentifySilences(cleaned, sampleRate, 1000);
  assert.equal(silences.length, 1);
  assert.ok(silences[0]!.startMs >= 450 && silences[0]!.startMs <= 550);
  assert.ok(silences[0]!.endMs >= 1750 && silences[0]!.endMs <= 1850);
});

test('5. generateDisfluencyEdl unions overlapping silence and filler ranges with 15ms padding', () => {
  const silences = [{ startMs: 2000, endMs: 3500 }]; // 2.0s - 3.5s
  const fillers = [{ start: 3.48, end: 4.0 }]; // Overlaps with silence around 3.5s

  const edl = generateDisfluencyEdl(silences, fillers, 15);
  assert.equal(edl.length, 1); // Should union into a single contiguous block
  assert.ok(edl[0]!.start <= 2.015);
  assert.ok(edl[0]!.end >= 4.015);
});

test('6. executeAudioEnhancementWorkflow checks if transcript is already generated then reuses, otherwise generates', async () => {
  const sampleRate = 16000;
  const pcm = new Float32Array(sampleRate);

  const existingTokens: WordToken[] = [
    { id: 't1', text: 'Well', start: asSourceSeconds(0.0), end: asSourceSeconds(0.4), deleted: false },
    { id: 't2', text: 'um', start: asSourceSeconds(0.4), end: asSourceSeconds(0.8), deleted: false, isFiller: true },
    { id: 't3', text: 'there', start: asSourceSeconds(0.8), end: asSourceSeconds(1.2), deleted: false },
  ];

  let transcribeCalled = false;
  const mockTranscribe = async () => {
    transcribeCalled = true;
    return [];
  };

  // Case A: Transcript already exists -> must reuse and NOT call transcribeFn!
  const resReuse = await executeAudioEnhancementWorkflow(pcm, {
    existingTranscriptTokens: existingTokens,
    transcribeFn: mockTranscribe,
  });

  assert.equal(resReuse.wasTranscriptReused, true);
  assert.equal(transcribeCalled, false);
  assert.equal(resReuse.tokens.length, 3);
  assert.ok(resReuse.disfluentTokenIndices.includes(1)); // 'um' flagged
  assert.equal(resReuse.disfluentBioTags[1], 'B-DISFLUENCY');

  // Case B: Transcript does not exist -> must call transcribeFn!
  const resGenerate = await executeAudioEnhancementWorkflow(pcm, {
    existingTranscriptTokens: [],
    transcribeFn: async () => [
      { id: 'gen1', text: 'Generated', start: asSourceSeconds(0), end: asSourceSeconds(1), deleted: false },
    ],
  });

  assert.equal(resGenerate.wasTranscriptReused, false);
  assert.equal(resGenerate.tokens.length, 1);
  assert.equal(resGenerate.tokens[0]!.text, 'Generated');
});

test('7. classifyFdtDisfluencies performs context-aware BIO sequence labeling across repetitions, false starts, and fillers', async () => {
  const tokens: WordToken[] = [
    { id: '1', text: 'we', start: asSourceSeconds(0.0), end: asSourceSeconds(0.2), deleted: false },
    { id: '2', text: 'we', start: asSourceSeconds(0.25), end: asSourceSeconds(0.45), deleted: false }, // Repetition -> token 0 flagged
    { id: '3', text: 'have', start: asSourceSeconds(0.5), end: asSourceSeconds(0.8), deleted: false },
    { id: '4', text: 'to', start: asSourceSeconds(0.85), end: asSourceSeconds(1.0), deleted: false },
    { id: '5', text: 'um', start: asSourceSeconds(1.1), end: asSourceSeconds(1.4), deleted: false }, // Filler
    { id: '5b', text: 'get', start: asSourceSeconds(1.45), end: asSourceSeconds(1.6), deleted: false }, // Fluent word
    { id: '6', text: 'you', start: asSourceSeconds(1.65), end: asSourceSeconds(1.8), deleted: false }, // Multi-word filler start
    { id: '7', text: 'know', start: asSourceSeconds(1.85), end: asSourceSeconds(2.0), deleted: false }, // Multi-word filler cont
    { id: '8', text: 'ready', start: asSourceSeconds(2.1), end: asSourceSeconds(2.3), deleted: false },
  ];

  const result = await classifyFdtDisfluencies(tokens);

  // Token 0 ("we") should be flagged as B-DISFLUENCY (repetition)
  assert.ok(result.flaggedIndices.includes(0));
  assert.equal(result.bioTags[0], 'B-DISFLUENCY');
  assert.equal(result.bioTags[1], 'O'); // kept second occurrence

  // Token 4 ("um") should be flagged as B-DISFLUENCY
  assert.ok(result.flaggedIndices.includes(4));
  assert.equal(result.bioTags[4], 'B-DISFLUENCY');
  assert.equal(result.bioTags[5], 'O'); // "get" is fluent

  // Token 6 & 7 ("you know") should be flagged as B-DISFLUENCY and I-DISFLUENCY
  assert.ok(result.flaggedIndices.includes(6));
  assert.ok(result.flaggedIndices.includes(7));
  assert.equal(result.bioTags[6], 'B-DISFLUENCY');
  assert.equal(result.bioTags[7], 'I-DISFLUENCY');

  // IntervalsSec should contain Whisper word boundaries for all cut candidates
  assert.equal(result.intervalsSec.length, result.flaggedIndices.length);
  assert.equal(result.intervalsSec[0]!.start, 0.0);
  assert.equal(result.intervalsSec[0]!.end, 0.2);
});

test('8. classifyFdtDisfluencies integrates ONNX sequence tagger callback with exact boundary mappings', async () => {
  const tokens: WordToken[] = [
    { id: 'a', text: 'I', start: asSourceSeconds(1.0), end: asSourceSeconds(1.2), deleted: false },
    { id: 'b', text: 'think', start: asSourceSeconds(1.25), end: asSourceSeconds(1.6), deleted: false },
    { id: 'c', text: 'today', start: asSourceSeconds(1.65), end: asSourceSeconds(2.0), deleted: false },
  ];

  const mockOnnxClassifier = async (words: string[]): Promise<BioTag[]> => {
    assert.deepEqual(words, ['I', 'think', 'today']);
    return ['B-DISFLUENCY', 'I-DISFLUENCY', 'O'];
  };

  const result = await classifyFdtDisfluencies(tokens, undefined, mockOnnxClassifier);

  assert.deepEqual(result.flaggedIndices, [0, 1]);
  assert.deepEqual(result.bioTags, ['B-DISFLUENCY', 'I-DISFLUENCY', 'O']);
  assert.equal(result.intervalsSec.length, 2);
  assert.equal(result.intervalsSec[0]!.start, 1.0);
  assert.equal(result.intervalsSec[1]!.end, 1.6);
});
