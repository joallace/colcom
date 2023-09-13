export default function Icon({ isDesktop = true }) {
    return (
        <>
            col
            <text style={{ color: 'white' }}>{isDesktop ? "." : <br />}</text>
            <text style={{ color: '#BC5217' }}>com</text>
        </>
    )
}