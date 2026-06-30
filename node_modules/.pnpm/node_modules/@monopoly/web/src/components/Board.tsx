import React from 'react';
import { useGameStore } from '../store';

export const Board: React.FC = () => {
  const { gameState } = useGameStore();

  if (!gameState) return null;

  // Render a visual abstraction of the board.
  // Real Monopoly boards have 40 tiles. For this UI, we just render a simple grid/ring representation.
  
  return (
    <div className="relative w-full max-w-[800px] aspect-square bg-board-bg shadow-2xl rounded-xl border-4 border-gray-800 overflow-hidden flex items-center justify-center">
      
      {/* Center Logo */}
      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 pointer-events-none transform -rotate-45">
         <h1 className="text-8xl font-black text-monopoly-red tracking-widest drop-shadow-lg">MONOPOLY</h1>
      </div>
      
      {/* Visual Tile Debug (since full board rendering requires exact map coordinates) */}
      <div className="w-full h-full p-16 z-10 flex flex-wrap gap-2 content-start">
         <div className="w-full bg-white/50 backdrop-blur-md p-6 rounded-lg border border-white/20 shadow-xl">
           <h3 className="text-xl font-bold text-gray-800 mb-2">Game Board Active</h3>
           <p className="text-sm text-gray-600">The server handles all rules. Client visualizes the board dynamically based on the MapConfig.</p>
           
           <div className="mt-6 flex flex-wrap gap-2">
             {Object.values(gameState.players).map(p => (
               <div key={p.id} className="flex flex-col items-center p-3 bg-white rounded-md shadow border border-gray-200">
                 <div className="h-6 w-6 rounded-full bg-monopoly-blue mb-2 shadow-inner" />
                 <span className="text-xs font-bold text-gray-800">{p.id}</span>
                 <span className="text-xs text-gray-500">Tile: {p.position}</span>
               </div>
             ))}
           </div>
         </div>
      </div>
      
    </div>
  );
};
