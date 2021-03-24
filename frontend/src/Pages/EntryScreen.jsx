import { React, useContext } from 'react';
import { animated, useSpring } from 'react-spring';
import TopBarSettings from '../Components/TopBarSettings';
import Player from '../Components/Player';
import { LobbyContext } from '../Context';

const EntryScreen = () => {
    const { state: lobbyState } = useContext(LobbyContext);
    const props = useSpring({
        to: { opacity: 1 },
        from: { opacity: 0.1 },
        delay: 500,
        reset: true,
    });
    return (
        <div>
            <animated.div style={props}>
                <TopBarSettings currentScreen={`You are a ${lobbyState.role}`} />
                <div style={{ textAlign: 'center' }}>
                    <Player playerName={lobbyState.nickname} />
                </div>
            </animated.div>
        </div>
    );
};

export default EntryScreen;
