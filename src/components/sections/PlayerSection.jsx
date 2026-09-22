/** レコード情報、回転操作、再生状態、音声コントロールを描画する。 */
export default function PlayerSection() {
    return (
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

            <div id='playerPanel' className='player' role='region' aria-label='レコードプレーヤー'>
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
            </div>
        </section>
    );
}
