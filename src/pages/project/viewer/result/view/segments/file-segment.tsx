
export const FileSegment = ({url}) => {
  return <div>
    <img src={`${url}?t=${Date.now()}`} alt="generated-image" width="750px" height="750px" style={{
      display: 'block',
      marginLeft: 'auto',
      marginRight: 'auto'
    }}/>
  </div>
}