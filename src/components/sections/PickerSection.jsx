export default function PickerSection() {
    return (
        <section id='PagePicker'>
            <div id='pickerPanel' className='picker-panel' aria-label='レコードを変更' hidden>
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
            </div>
        </section>
    );
}
