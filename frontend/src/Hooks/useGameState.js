import { constructPlayersOnTrialStatus, nightTimeStatus } from '../GameUtils';
import { useContext, useReducer, useEffect } from 'react';
import { LobbyContext } from '../App';
import socket from '../Socket';

const initialState = {
    screen: 'entry',
    dayPeriod: 'day', // night or day
    dayNumber: 1, // what day it is
    alivePlayers: [], // the players that are alive. initialized to all players
    status: '',
    winningRole: '',
    winners: [],
    phase: '',
    role: '',
    nickname: '',
    isDead: false,
    checkedPlayers: [],
    votingState: {
        type: '', // role or discussion or trial or undefined
        votablePlayers: [], // what other players can we vote for
        vote: '', // my current Vote
        playersWhoVoted: [], // other players who have voted
        killedPlayer: '', // the outcome of the vote
        timeToVote: '', // time to vote
        isOnTrial: false,
    },
};

const reducer = (state, action) => {
    switch (action.type) {
        case 'init': {
            return {
                ...state,
                alivePlayers: [...action.alivePlayers],
                role: action.role,
                nickname: action.nickname,
            };
        }

        case 'night-start': {
            return {
                ...state,
                phase: 'night-start',
                status: action.status,
                dayPeriod: 'night',
                screen: 'core',
                votingState: {
                    ...state.votingState,
                    type: 'role',
                    votablePlayers: [...action.votablePlayers],
                    timeToVote: action.timeToVote,
                },
            };
        }

        case 'show-selected': {
            return {
                ...state,
                status: action.status,
                votingState: { ...state.votingState, vote: action.vote },
            };
        }

        case 'abstain': {
            return {
                ...state,
                status: action.status,
                votingState: { ...state.votingState, vote: '' },
            };
        }

        case 'night-end': {
            return {
                ...state,
                phase: 'night-end',
                status: action.status,
                alivePlayers: state.alivePlayers.filter((p) => p !== action.playerKilled),
                isDead: action.isDead ? action.isDead : state.isDead,
                votingState: {
                    ...initialState.votingState,
                },
            };
        }

        case 'day-start': {
            return {
                ...state,
                phase: 'day-start',
                dayPeriod: 'day',
                dayNumber: state.dayNumber + 1,
                status: action.status,
                votingState: {
                    ...state.votingState,
                    timeToVote: action.timeToVote,
                    type: 'discussion',
                    votablePlayers: [...action.votablePlayers],
                },
            };
        }

        case 'discussion-end': {
            return {
                ...state,
                phase: 'discussion-end',
                status: action.status,
                votingState: {
                    ...initialState.votingState,
                    type: 'trial',
                    ...(action.votablePlayers.length && {
                        votablePlayers: action.votablePlayers,
                    }),
                    isOnTrial: action.isOnTrial,
                },
            };
        }

        case 'trial-start': {
            return {
                ...state,
                phase: 'trial-start',
                status: action.status,
                votingState: {
                    ...state.votingState,
                    timeToVote: action.timeToVote,
                },
            };
        }
        case 'trial-end': {
            return {
                ...state,
                phase: 'trial-start',
                status: action.status,
                alivePlayers: state.alivePlayers.filter((p) => p !== action.playerKilled),
                isDead: action.isDead ? action.isDead : state.isDead,
                votingState: {
                    ...initialState.votingState,
                },
            };
        }

        case 'game-over': {
            return {
                ...state,
                phase: 'game-over',
                screen: 'end',
                status: `${action.winningRole} wins!`,
                winningRole: action.winningRole,
                winners: [...action.winners],
            };
        }

        case 'vote-update': {
            return {
                ...state,
                votingState: {
                    ...state.votingState,
                    playersWhoVoted: action.playersWhoVoted,
                },
            };
        }

        case 'suspect-reveal': {
            return {
                ...state,
                checkedPlayers: [...state.checkedPlayers, action.checkedPlayer],
            };
        }

        case 'skip-trial': {
            return {
                ...state,
                status: action.status,
                votingState: {
                    ...initialState.votingState,
                },
            };
        }

        default:
            throw new Error(`Invalid Game State reducer action: ${action.type}`);
    }
};

export default function useGameState() {
    const [state, dispatch] = useReducer(reducer, initialState);
    const { state: lobbyState } = useContext(LobbyContext);

    /**
     * This effect will run on first render to initialise the alive players.
     * We may need to lie about the dependency so that players dont just 'leave'
     */
    useEffect(() => {
        const { nickname, role } = lobbyState;

        dispatch({
            type: 'init',
            alivePlayers: lobbyState.players,
            role,
            nickname,
        });
    }, [lobbyState]);

    useEffect(() => {
        function onNightStart({ timeToVote }) {
            const { role } = lobbyState;
            const { isDead } = state;

            const status = isDead ? 'You are dead and cannot vote' : nightTimeStatus[role];
            const votablePlayers = getVotablePlayers(role);

            dispatch({
                type: 'night-start',
                status,
                votablePlayers,
                timeToVote,
            });
        }

        function onNightEnd({ playerKilled, isGameOver }) {
            console.log(playerKilled);
            dispatch({
                type: 'night-end',
                status: playerKilled ? `${playerKilled} was killed in the night...` : `Nobody died in the night!`,
                playerKilled,
                ...(playerKilled === lobbyState.nickname ? { isDead: true } : {}),
            });

            if (!isGameOver) {
                lobbyState.isHost && setTimeout(() => socket.emit('start-day'), 2000);
            }
        }

        function onDayStart({ timeToVote }) {
            const { isDead } = state;

            const status = isDead ? 'You are dead and cannot vote' : 'Select someone to be on trial';

            dispatch({
                type: 'day-start',
                status,
                votablePlayers: state.alivePlayers.filter((p) => p !== lobbyState.nickname),
                timeToVote,
            });
        }

        function onDiscussionEnd({ playerOnTrial }) {
            // If no one is on trial, then skip the trial and go to night
            if (playerOnTrial === null) {
                dispatch({
                    type: 'skip-trial',
                    status: 'No one is on trial',
                });

                lobbyState.isHost && setTimeout(() => socket.emit('start-night'), 2000);
                return;
            }

            dispatch({
                type: 'discussion-end',
                status: constructPlayersOnTrialStatus(playerOnTrial),
                votablePlayers: [playerOnTrial],
                isOnTrial: playerOnTrial === lobbyState.nickname,
            });

            lobbyState.isHost && setTimeout(() => socket.emit('start-trial'), 2000);
        }

        function onTrialStart({ timeToVote }) {
            let status = '';

            if (state.isDead) {
                status = 'You are dead and cannot vote';
            } else {
                if (state.votingState.isOnTrial) {
                    status = 'You are on trial';
                } else {
                    status = 'Vote for the player on trial to kill them';
                }
            }

            dispatch({
                type: 'trial-start',
                status,
                timeToVote,
            });
        }

        function onTrialEnd({ playerKilled, isGameOver }) {
            let status = '';

            if (playerKilled === null || playerKilled === 'abstain Vote') {
                status = 'Nobody was killed in the Trial!';
            } else {
                status = `The town voted to kill ${playerKilled}!`;
            }

            dispatch({
                type: 'trial-end',
                status,
                playerKilled,
                ...(playerKilled === lobbyState.nickname ? { isDead: true } : {}),
            });

            if (!isGameOver) {
                lobbyState.isHost && setTimeout(() => socket.emit('start-night'), 2000);
            }
        }

        function onGameOver({ winningRole, winners }) {
            dispatch({
                type: 'game-over',
                winningRole: winningRole.toLowerCase(),
                winners,
            });
        }

        function onVoteUpdate({ voteMap }) {
            dispatch({
                type: 'vote-update',
                playersWhoVoted: Object.keys(voteMap),
            });
        }

        function onSuspectReveal(checkedPlayer) {
            dispatch({
                type: 'suspect-reveal',
                checkedPlayer,
            });
        }

        function getVotablePlayers(role) {
            // Your nickname
            const { nickname } = state;

            switch (role) {
                // If you are mafia, you can vote for any alive players but not yourself
                case 'mafia':
                    return state.alivePlayers.filter((p) => p !== nickname);
                // If you are detective, you can vote for any alive player you havent checked already
                case 'detective':
                    const checkedPlayers = state.checkedPlayers.map((p) => p.nickname);

                    return state.alivePlayers.filter((p) => p !== nickname && !checkedPlayers.includes(p));
                // If you are medic then you can vote for anyone alive
                case 'medic':
                    return state.alivePlayers;
                // If you are civilian or jester, you cannot vote for anyone.
                case 'civilian':
                case 'jester':
                    return [];
                default:
                    throw new Error('Invalid role');
            }
        }

        socket.on('night-start', onNightStart);
        socket.on('night-end', onNightEnd);
        socket.on('day-start', onDayStart);
        socket.on('discussion-end', onDiscussionEnd);
        socket.on('trial-start', onTrialStart);
        socket.on('trial-end', onTrialEnd);
        socket.on('game-over', onGameOver);
        socket.on('day-vote-update', onVoteUpdate);
        socket.on('trial-vote-update', onVoteUpdate);
        socket.on('suspect-reveal', onSuspectReveal);

        return () => {
            socket.removeListener('night-start', onNightStart);
            socket.removeListener('night-end', onNightEnd);
            socket.removeListener('day-start', onDayStart);
            socket.removeListener('discussion-end', onDiscussionEnd);
            socket.removeListener('trial-start', onTrialStart);
            socket.removeListener('trial-end', onTrialEnd);
            socket.removeListener('game-over', onGameOver);
            socket.removeListener('day-vote-update', onVoteUpdate);
            socket.removeListener('trial-vote-update', onVoteUpdate);
            socket.removeListener('suspect-reveal', onSuspectReveal);
        };
    }, [state, lobbyState]);

    return [state, dispatch];
}
