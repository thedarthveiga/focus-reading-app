import Anthropic from "@anthropic-ai/sdk";

import { ExternalServiceError } from "../../../domain/errors/DomainError";
import {
  AIPlaylistComposerPort,
  ComposePlaylistInput,
  ComposePlaylistOutput,
  WordCountInput,
} from "../../../ports/driven/AIPlaylistComposerPort";
import { logger } from "../../../shared/logger";

const SYSTEM_PROMPT = `You are an expert literary analyst and music curator for a reading focus app.
You help readers stay immersed by estimating chapter lengths and curating matching instrumental playlists.
Always respond with valid JSON only — no markdown, no explanation, just the JSON object.`;

export class ClaudePlaylistComposerAdapter implements AIPlaylistComposerPort {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async estimateWordCount(input: WordCountInput): Promise<number> {
    const { correlationId, bookTitle, chapterNumber, chapterTitle } = input;
    logger.info(
      { correlationId },
      "ClaudePlaylistComposerAdapter.estimateWordCount - calling Claude API",
    );

    try {
      const chapterRef = chapterTitle
        ? `"${chapterTitle}"`
        : `Chapter ${chapterNumber}`;
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Estimate the word count for ${chapterRef} of the book "${bookTitle}". Return ONLY: {"wordCount": <integer>}`,
          },
        ],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const parsed = JSON.parse(text) as { wordCount: number };
      const wordCount = Math.max(500, Math.min(50000, parsed.wordCount));

      logger.info(
        { correlationId, wordCount },
        "ClaudePlaylistComposerAdapter.estimateWordCount - completed",
      );
      return wordCount;
    } catch (err) {
      logger.error(
        {
          correlationId,
          error: (err as Error).message,
          stack: (err as Error).stack,
          code: (err as { code?: string }).code ?? "UNKNOWN",
        },
        "ClaudePlaylistComposerAdapter.estimateWordCount - error occurred",
      );
      throw new ExternalServiceError(
        "Claude",
        `Failed to estimate word count: ${(err as Error).message}`,
      );
    }
  }

  async composePlaylist(
    input: ComposePlaylistInput,
  ): Promise<ComposePlaylistOutput> {
    const {
      correlationId,
      bookTitle,
      chapterNumber,
      chapterTitle,
      mode,
      estimatedDurationMinutes,
    } = input;
    logger.info(
      { correlationId },
      "ClaudePlaylistComposerAdapter.composePlaylist - calling Claude API",
    );

    try {
      const chapterRef = chapterTitle
        ? `${chapterNumber} "${chapterTitle}"`
        : `${chapterNumber}`;
      const modeDescription =
        mode === "focus"
          ? "deep concentration — prefer minimal, repetitive, ambient (Brian Eno, Stars of the Lid, Harold Budd)"
          : "flowing engagement — prefer cinematic, emotive instrumental (Max Richter, Hans Zimmer, Ólafur Arnalds)";

      const response = await this.client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Suggest instrumental tracks for a reading session:
Book: "${bookTitle}"
Chapter: ${chapterRef}
Mode: ${mode} — ${modeDescription}
Duration: ${estimatedDurationMinutes} minutes

Return ONLY: {"playlistName": "string", "tracks": [{"title": "string", "artist": "string"}]}
Suggest 6-8 tracks. All must be real, instrumental, and available on Spotify.`,
          },
        ],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "{}";
      let parsed: ComposePlaylistOutput;

      try {
        parsed = JSON.parse(text) as ComposePlaylistOutput;
      } catch {
        logger.warn(
          { correlationId },
          "ClaudePlaylistComposerAdapter.composePlaylist - JSON parse failed, using fallback",
        );
        parsed = {
          playlistName: `Focus Mix — ${bookTitle} Ch.${chapterNumber}`,
          tracks: [
            { title: "Experience", artist: "Ludovico Einaudi" },
            { title: "On the Nature of Daylight", artist: "Max Richter" },
            { title: "An Ending (Ascent)", artist: "Brian Eno" },
            { title: "Nuvole Bianche", artist: "Ludovico Einaudi" },
            { title: "Spiegel im Spiegel", artist: "Arvo Pärt" },
          ],
        };
      }

      logger.info(
        { correlationId, trackCount: parsed.tracks.length },
        "ClaudePlaylistComposerAdapter.composePlaylist - completed",
      );
      return parsed;
    } catch (err) {
      if (err instanceof ExternalServiceError) throw err;
      logger.error(
        {
          correlationId,
          error: (err as Error).message,
          stack: (err as Error).stack,
          code: (err as { code?: string }).code ?? "UNKNOWN",
        },
        "ClaudePlaylistComposerAdapter.composePlaylist - error occurred",
      );
      throw new ExternalServiceError(
        "Claude",
        `Failed to compose playlist: ${(err as Error).message}`,
      );
    }
  }
}
