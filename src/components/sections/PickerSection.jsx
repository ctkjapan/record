/** レコード選択画面の見出しとカード一覧を描画する。 */
export default function PickerSection() {
    return (
        <section id='PagePicker'>
            <div id='pickerPanel' className='picker-panel' role='region' aria-label='レコードを変更' hidden>
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
            </div>
        </section>
    );
}
