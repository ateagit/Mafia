import styles from '../Styles/Player.module.css';
import classNames from 'classnames';
import { GameContext } from '../Pages/GamePage';
import socket from '../Socket';
import { useContext } from 'react';

/**
 * The player component represents a specific player on the board.
 * Styling is applied conditionally based on the state of the player e.g. dead, voted, is you etc.
 * @param { playerName, style, childRef } playerName is nickname of player, style is
 * additional custom styling, childRef is used by table component to get height/width info
 * @returns component representing player.
 */
export default function Player({ playerName, style, childRef }) {
    const { state, dispatch } = useContext(GameContext);

    // Destructuring relevant properties from game state.
    const {
        alivePlayers,
        nickname,
        role,
        checkedPlayers,
        isDead,
        votingState: { votablePlayers, vote, playersWhoVoted, type, isOnTrial },
    } = state;

    /*
     A player is dead if they are not in the alivePlayers list.
     Note that this is different from isDead in gameState.
     isDead refers to if the client/you is dead in the game
     currentPlayerIsDead refers to if the player being rendered is dead
    */
    const currentPlayerIsDead = !alivePlayers.includes(playerName);

    // A player is hoverable if they are votable.
    const currentPlayerIsHoverable = !isOnTrial && !isDead && votablePlayers.includes(playerName);

    // A player has voted if they are in the playersWhoVoted list.
    const currentPlayerHasVoted = playersWhoVoted.includes(playerName);

    // A player is a voteTarget if you have voted for them.
    const currentPlayerIsVoteTarget = vote === playerName;

    // A player is you if its playername matches your name.
    const currentPlayerIsPlayer = nickname === playerName;

    // apply styles based on whether certain props is true
    const playerStyle = classNames({
        [styles.playerWrapper]: true,
        [styles.player]: currentPlayerIsPlayer,
        [styles.isHoverable]: currentPlayerIsHoverable,
        [styles.hasVoted]: currentPlayerHasVoted,
        [styles.isClicked]: currentPlayerIsVoteTarget,
        [styles.isDead]: currentPlayerIsDead,
    });

    // this only allows clicks to propagate if a player is actually hoverable and is not currently clicked.
    function validateOnClick(fn) {
        return (...args) => {
            const detectiveHasSuspected = role === 'detective' && vote;

            if (currentPlayerIsHoverable && !currentPlayerIsVoteTarget && !detectiveHasSuspected) {
                fn(...args);
            }
        };
    }

    function onClick() {
        // Emit the correct vote event depending on what type of vote it is.
        switch (type) {
            case 'role':
                socket.emit(`${role}-vote`, { votingFor: playerName });
                dispatch({ type: 'show-selected', status: `Selected ${playerName} for ability`, vote: playerName });
                break;
            case 'discussion':
                socket.emit(`day-vote`, { votingFor: playerName });
                dispatch({ type: 'show-selected', status: `Voted ${playerName} for trial`, vote: playerName });
                break;
            case 'trial':
                socket.emit(`trial-vote`, { votingFor: playerName });
                dispatch({ type: 'show-selected', status: `Voted to kill ${playerName}`, vote: playerName });
                break;
            default:
                throw new Error('Invalid voting type');
        }
    }

    // Get a string representing if a player is a mafia or not (making sure they are a detective)
    function getDetectiveString() {
        if (role !== 'detective') {
            return null;
        }

        for (const checkedPlayer of checkedPlayers) {
            if (checkedPlayer.nickname === playerName) {
                return checkedPlayer.isMafia ? ' (Mafia)' : ' (Not Mafia)';
            }
        }

        return null;
    }

    return (
        <div className={playerStyle} style={style} ref={childRef} onClick={validateOnClick(onClick)}>
            <div className={styles.playerText}>
                <p>{playerName.concat(currentPlayerIsDead ? ' (DEAD)' : '')}</p>
                <p>{getDetectiveString()}</p>
            </div>
        </div>
    );
}
