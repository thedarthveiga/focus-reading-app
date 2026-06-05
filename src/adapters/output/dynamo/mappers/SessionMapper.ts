import { ReadingSession } from "../../../../domain/entities/ReadingSession";
import { GeneratedPlaylist } from "../../../../domain/value-objects/GeneratedPlaylist";
import { ReadingMode } from "../../../../domain/value-objects/ReadingMode";
import { SessionStatus } from "../../../../domain/value-objects/SessionStatus";
import { TrackSuggestion } from "../../../../domain/value-objects/TrackSuggestion";
import { Keys } from "../DynamoKeys";

export interface SessionDynamoItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: "SESSION";
  id: string;
  userId: string;
  bookTitle: string;
  chapterNumber: number;
  chapterTitle?: string;
  mode: string;
  estimatedDurationMinutes: number;
  status: string;
  playlistSpotifyId: string;
  playlistSpotifyUrl: string;
  playlistName: string;
  playlistTracks: string;
  playlistDurationMinutes: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  pausedAt?: string;
  totalPausedSeconds: number;
}

export const SessionMapper = {
  toItem(session: ReadingSession): SessionDynamoItem {
    const item: SessionDynamoItem = {
      PK: Keys.session.pk(session.id),
      SK: Keys.session.sk(),
      GSI1PK: Keys.gsi1.userSessionsPk(session.userId),
      GSI1SK: Keys.session.userSessionSk(session.id),
      entityType: "SESSION",
      id: session.id,
      userId: session.userId,
      bookTitle: session.bookTitle,
      chapterNumber: session.chapterNumber,
      mode: session.mode,
      estimatedDurationMinutes: session.estimatedDurationMinutes,
      status: session.status,
      playlistSpotifyId: session.playlist.spotifyPlaylistId,
      playlistSpotifyUrl: session.playlist.spotifyPlaylistUrl,
      playlistName: session.playlist.name,
      playlistTracks: JSON.stringify(session.playlist.tracks),
      playlistDurationMinutes: session.playlist.durationMinutes,
      createdAt: session.createdAt.toISOString(),
      totalPausedSeconds: session.totalPausedSeconds,
    };
    if (session.chapterTitle) item.chapterTitle = session.chapterTitle;
    if (session.startedAt) item.startedAt = session.startedAt.toISOString();
    if (session.completedAt)
      item.completedAt = session.completedAt.toISOString();
    if (session.pausedAt) item.pausedAt = session.pausedAt.toISOString();
    return item;
  },

  toDomain(item: SessionDynamoItem): ReadingSession {
    const tracks = JSON.parse(item.playlistTracks) as TrackSuggestion[];
    const playlist: GeneratedPlaylist = {
      spotifyPlaylistId: item.playlistSpotifyId,
      spotifyPlaylistUrl: item.playlistSpotifyUrl,
      name: item.playlistName,
      tracks,
      durationMinutes: item.playlistDurationMinutes,
    };
    const session = ReadingSession.prepare(
      item.id,
      item.userId,
      item.bookTitle,
      item.chapterNumber,
      item.chapterTitle,
      item.mode as ReadingMode,
      item.estimatedDurationMinutes,
      playlist,
    );
    return applyStatus(session, item);
  },
};

function applyStatus(
  session: ReadingSession,
  item: SessionDynamoItem,
): ReadingSession {
  const status = item.status as SessionStatus;
  if (status === "pending") return session;
  const current = session.start();
  if (status === "active") return current;
  if (status === "paused") return current.pause();
  if (status === "completed") return current.complete();
  if (status === "interrupted") return current.interrupt();
  return current;
}
