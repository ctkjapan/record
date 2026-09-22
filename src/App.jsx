export default function App() {
    return (
        <>
            <section className='splash-screen' id='splashScreen' role='dialog' aria-modal='true' aria-labelledby='splashTitle' aria-describedby='splashStatus'>
                <div className='splash-content'>
                    <p className='splash-kicker'>
                        <span className='wordmark'>
                            <span className='wordmark-mark' aria-hidden='true' />
                        </span>
                    </p>
                    <h1 id='splashTitle'>Put the needle on.</h1>
                    <button className='button splash-button' id='splashStartButton' type='button'>
                        TAP TO START
                    </button>
                    <p className='splash-status' id='splashStatus' aria-live='polite'>
                        Tap to enable audio.
                    </p>
                </div>
            </section>

            <header className='top-bar'>
                <button className='wordmark' id='menuButton' type='button' aria-label='メニューを開く' aria-controls='menuPanel' aria-expanded='false'>
                    <span className='wordmark-mark' aria-hidden='true' />
                </button>
                <nav className='top-bar-actions' id='menuPanel' aria-label='メニュー' hidden>
                    <button className='button change-button close-menu' id='changeButton' type='button' aria-pressed='false'>
                        Choose
                        <br />
                        your vinyl.
                    </button>
                    <h2>playback speed</h2>
                    <div className='playback-speed-changer'>
                        <button className='button' id='playbackX1Button' type='button'>
                            1.0
                        </button>
                        <button className='button' id='PlaybackSpeedReduction' type='button'>
                            -0.1
                        </button>
                        <button className='button' id='PlaybackSpeedIncrement' type='button'>
                            +0.1
                        </button>
                        <button className='button' id='playbackReverse' type='button' aria-pressed='false'>
                            REVERSE
                        </button>
                    </div>
                    <h2>player option</h2>
                    <div className='player-option'>
                        <button className='button noise-button' id='noiseButton' type='button' aria-pressed='false'>
                            NOISE
                        </button>
                        <button className='button visualizer-button' id='visualizerButton' type='button' aria-pressed='true'>
                            VISUALIZER
                        </button>
                    </div>
                </nav>
            </header>

            <main className='app-shell'>
                <section id='PagePlayer'>
                    <section id='hero' className='hero' aria-labelledby='pageTitle'>
                        <div className='album-heading'>
                            <p className='album-index'>
                                <span id='albumNumber'>01</span> / <span id='albumMaxNumber'>99</span>
                            </p>
                            <h1 id='pageTitle'>
                                <span id='albumArtist'>Artist</span>
                                <em id='albumTitle'>Title</em>
                            </h1>
                        </div>
                    </section>

                    <section id='playerPanel' className='player' aria-label='レコードプレーヤー'>
                        <div id='playerStage' className='player-stage'>
                            <canvas className='visualizer' id='visualizer' aria-hidden='true' />
                            <div className='record-shadow' aria-hidden='true' />
                            <div className='record' id='record' role='slider' tabIndex='0' aria-label='レコードを回す' aria-valuemin='0' aria-valuemax='360' aria-valuenow='0'>
                                <div className='grooves grooves-one' />
                                <div className='grooves grooves-two' />
                                <div className='label' id='label' />
                            </div>
                        </div>
                        <div className='player-footer'>
                            <div className='audio-progress'>
                                <input className='audio-seek' id='audioSeek' type='range' min='0' max='0' step='0.01' defaultValue='0' aria-label='音声の再生位置' disabled />
                                <div className='audio-time-readout'>
                                    <span>TIME</span>
                                    <strong id='audioTime'>00:00 / 00:00</strong>
                                </div>
                            </div>
                            <div className='speed-readout'>
                                <span>PLAYBACK</span>
                                <strong id='playbackRateValue'>0.00x</strong>
                            </div>
                            <div className='meter' aria-label='回転速度'>
                                <span id='meterFill' />
                            </div>
                            <p className='angle-readout'>
                                <span>ROTATION</span>
                                <strong id='angleValue'>000°</strong>
                            </p>
                            <div className='now-playing' aria-live='polite'>
                                <span className='status-dot' />
                                <span id='playState'>READY TO SPIN</span>
                            </div>
                        </div>
                    </section>
                </section>

                <section id='PagePicker'>
                    <section id='pickerPanel' className='picker-panel' aria-label='レコードを変更' hidden>
                        <div className='picker-heading'>
                            <div>
                                <h2>
                                    Choose
                                    <br />
                                    your vinyl.
                                </h2>
                            </div>
                        </div>
                        <div className='picker-window'>
                            <div className='picker-track' id='pickerTrack' />
                        </div>
                        <div className='picker-footer'>
                            <p>
                                <span id='pickerPosition'>01</span> / <span id='pickerPositionMax'>99</span>
                            </p>
                            <p id='pickerStatus'>中央のレコードをクリックして選択</p>
                            <p className='picker-instruction'>DRAG TO BROWSE →</p>
                        </div>
                    </section>
                </section>
            </main>
        </>
    );
}
