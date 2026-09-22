/** 初回タップによる音声有効化を案内するスプラッシュ画面を描画する。 */
export default function SplashSection() {
    return (
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
    );
}
