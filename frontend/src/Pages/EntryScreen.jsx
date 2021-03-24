import { React, useContext } from 'react';
import TopBarSettings from '../Components/TopBarSettings';
import Player from '../Components/Player';
import { animated, useSpring } from 'react-spring';
import { GameContext } from './GamePage';

const EntryScreen = () => {
    const { state: gameState } = useContext(GameContext);
    const props = useSpring({
        to: { opacity: 1 },
        from: { opacity: 0.1 },
        delay: 500,
        reset: true,
    });
    return (
        <div>
            <animated.div style={props}>
                <TopBarSettings currentScreen={`You are a ${gameState.role}`} />
                <div style={{ textAlign: 'center' }}>
                    <Player playerName={gameState.nickname} />
                </div>
            </animated.div>
        </div>
    );
};

export default EntryScreen;
