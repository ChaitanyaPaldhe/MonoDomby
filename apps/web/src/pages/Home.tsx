import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketClient, LobbyClient } from '../services';
import { useConnectionStore } from '../store';
import { v4 as uuidv4 } from 'uuid';

export const Home: React.FC = () => {
  const [roomId, setRoomId] = useState('');
  const [playerId, setPlayerId] = useState(`player_${Math.floor(Math.random() * 1000)}`);
  const navigate = useNavigate();
  const { status } = useConnectionStore();

  const handleConnect = () => {
    socketClient.connect(playerId);
  };

  const handleCreateRoom = () => {
    const newRoomId = uuidv4();
    LobbyClient.createRoom(newRoomId);
    navigate(`/room/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    if (roomId) {
      LobbyClient.joinRoom(roomId);
      navigate(`/room/${roomId}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-gray-800 p-8 shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            <span className="text-monopoly-red">MONO</span>
            <span className="text-monopoly-blue">POLY</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">Multiplayer Web Engine</p>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="playerId" className="block text-sm font-medium text-gray-300">
              Player ID
            </label>
            <div className="mt-1 flex space-x-2">
              <input
                id="playerId"
                type="text"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="block w-full rounded-md border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-monopoly-blue focus:ring-monopoly-blue sm:text-sm"
              />
              <button
                onClick={handleConnect}
                disabled={status === 'connected'}
                data-testid="btn-connect"
                className="flex items-center justify-center rounded-md bg-monopoly-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {status === 'connected' ? 'Connected' : 'Connect'}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-6">
            <button
              onClick={handleCreateRoom}
              disabled={status !== 'connected'}
              data-testid="btn-create-room"
              className="w-full rounded-md bg-monopoly-green px-4 py-3 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              Create New Room
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gray-800 px-2 text-gray-400">Or</span>
            </div>
          </div>

          <div>
            <label htmlFor="roomId" className="block text-sm font-medium text-gray-300">
              Join Existing Room
            </label>
            <div className="mt-1 flex space-x-2">
              <input
                id="roomId"
                type="text"
                placeholder="Room UUID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="block w-full rounded-md border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-monopoly-blue focus:ring-monopoly-blue sm:text-sm"
              />
              <button
                onClick={handleJoinRoom}
                disabled={status !== 'connected' || !roomId}
                data-testid="btn-join-room"
                className="flex items-center justify-center rounded-md bg-monopoly-yellow px-4 py-2 text-sm font-medium text-gray-900 hover:bg-yellow-500 disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
