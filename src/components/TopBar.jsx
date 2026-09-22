/** ブランド表示、レコード選択、再生設定を含むヘッダーを描画する。 */
export default function TopBar() {
    return (
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
    );
}
