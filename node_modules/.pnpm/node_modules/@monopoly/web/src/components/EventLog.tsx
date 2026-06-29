import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../store';

export const EventLog: React.FC = () => {
  const { eventLog } = useGameStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog]);

  return (
    <div className="flex flex-col flex-1 border-t border-gray-700 pt-4 overflow-hidden mt-4">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Event Log</h2>
      <div className="flex-1 overflow-y-auto space-y-2 text-sm pr-2 custom-scrollbar" data-testid="event-log">
        {eventLog.length === 0 ? (
          <div className="text-gray-600 italic">No events yet...</div>
        ) : (
          eventLog.map((log, idx) => (
            <div key={idx} className="bg-gray-900 p-2 rounded border border-gray-800">
              {log.action && (
                <div className="text-monopoly-blue font-semibold mb-1">
                  &gt; {log.action.type}
                </div>
              )}
              {log.events.map((e, eIdx) => (
                <div key={eIdx} className="text-gray-300 ml-2 border-l-2 border-gray-700 pl-2">
                  <span className="text-gray-500 text-xs">[{e.type}]</span>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
