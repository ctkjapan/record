import PickerSection from './components/sections/PickerSection.jsx';
import PlayerSection from './components/sections/PlayerSection.jsx';
import SplashSection from './components/sections/SplashSection.jsx';
import TopBar from './components/TopBar.jsx';

export default function App() {
    return (
        <>
            <SplashSection />
            <TopBar />

            <main className='app-shell'>
                <PlayerSection />
                <PickerSection />
            </main>
        </>
    );
}
