import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore, useConnectionStore } from '../store';
import { LobbyClient } from '../services';

export const Lobby: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const roomStore = useRoomStore();
  const connStore = useConnectionStore();
  const myPlayerId = connStore.playerId;
  const isHost = roomStore.players.length > 0 && roomStore.players[0] === myPlayerId;

  console.log("[LOBBY]");
  console.log("room players =", roomStore.players);
  console.log("myPlayerId =", myPlayerId);
  console.log("isHost =", isHost);

  const handleLeave = () => {
    if (id) {
      LobbyClient.leaveRoom(id);
      roomStore.clearRoom();
      navigate('/');
    }
  };

  const handleStartGame = () => {
    console.log("[CLIENT] Start Game button clicked");

    if (id) {
      console.log("[CLIENT] Calling LobbyClient.startGame", id);
      LobbyClient.startGame(id);
    }
  };

  // If the server pushes game state and room state is RUNNING, the game started
  React.useEffect(() => {
    if (roomStore.status === 'RUNNING') {
      navigate(`/game/${id}`);
    }
  }, [roomStore.status, id, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-2xl space-y-8 rounded-2xl bg-gray-800 p-8 shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Room: {id}</h1>
          <p className="mt-2 text-gray-400">Waiting for players...</p>
        </div>

        <div className="rounded-lg bg-gray-900 p-6">
          <h2 className="text-lg font-medium text-white mb-4">Players ({roomStore.players.length}/8)</h2>
          <ul className="space-y-2" data-testid="player-list">
            {roomStore.players.map((p: string, idx: number) => (
              <li key={idx} className="flex items-center justify-between rounded bg-gray-800 px-4 py-3 text-gray-300" data-testid={`player-lobby-item-${p}`}>
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-full bg-monopoly-blue flex items-center justify-center font-bold text-white">
                    {p.charAt(0).toUpperCase()}
                  </div>
                  <span>{p}</span>
                </div>
                <span className="text-xs px-2 py-1 bg-green-900 text-green-400 rounded-full">Ready</span>
              </li>
            ))}
            {roomStore.players.length === 0 && (
              <li className="text-gray-500 text-center py-4">No players joined yet.</li>
            )}
          </ul>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handleLeave}
            className="flex-1 rounded-md border border-gray-600 px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Leave Room
          </button>
          <button
            onClick={handleStartGame}
            disabled={roomStore.players.length < 2 || !isHost}
            data-testid="btn-start-game"
            className="flex-1 rounded-md bg-monopoly-green px-4 py-3 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {isHost ? 'Start Game' : 'Waiting for host...'}
          </button>
        </div>
      </div>
    </div>
  );
};
