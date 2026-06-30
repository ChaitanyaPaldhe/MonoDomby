import { io } from 'socket.io-client';

const socket1 = io('http://localhost:3000', { auth: { token: 'player1' } });
const socket2 = io('http://localhost:3000', { auth: { token: 'player2' } });

socket1.on('connect', () => {
  console.log('socket1 connected');
  socket1.emit('create_room', { roomId: 'test-room' }, (res: any) => {
    console.log('create_room res:', res);
    socket2.emit('join_room', { roomId: 'test-room' }, (res2: any) => {
      console.log('join_room res:', res2);
      socket1.emit('start_game', { roomId: 'test-room' }, (res3: any) => {
        console.log('start_game res:', res3);
        setTimeout(() => {
          process.exit(0);
        }, 1000);
      });
    });
  });
});
