import {
  AIPlaylistComposerPort,
  ComposePlaylistInput,
  ComposePlaylistOutput,
  WordCountInput,
} from "../../../ports/driven/AIPlaylistComposerPort";
import { logger } from "../../../shared/logger";

export class ClaudePlaylistComposerMockAdapter implements AIPlaylistComposerPort {
  estimateWordCount(input: WordCountInput): Promise<number> {
    logger.warn(
      { correlationId: input.correlationId },
      "ClaudePlaylistComposerMockAdapter.estimateWordCount - Using mock playlist composer — set ANTHROPIC_API_KEY for real AI",
    );
    return Promise.resolve(4500);
  }

  composePlaylist(input: ComposePlaylistInput): Promise<ComposePlaylistOutput> {
    logger.warn(
      { correlationId: input.correlationId },
      "ClaudePlaylistComposerMockAdapter.composePlaylist - Using mock playlist composer — set ANTHROPIC_API_KEY for real AI",
    );
    return Promise.resolve({
      playlistName: `Focus Mix — ${input.bookTitle} Ch.${input.chapterNumber}`,
      tracks: [
        { title: "Experience", artist: "Ludovico Einaudi" },
        { title: "Nuvole Bianche", artist: "Ludovico Einaudi" },
        { title: "On the Nature of Daylight", artist: "Max Richter" },
        { title: "An Ending (Ascent)", artist: "Brian Eno" },
        {
          title: "Comptine d'un autre été, l'après-midi",
          artist: "Yann Tiersen",
        },
      ],
    });
  }
}
