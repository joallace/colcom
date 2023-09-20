export default function Icon({ isDesktop = true }) {
    return (
        <>
            col
            <span style={{ color: 'white' }}>{isDesktop ? "." : <br />}</span>
            <span style={{ color: '#BC5217' }}>com</span>
        </>
    )
}