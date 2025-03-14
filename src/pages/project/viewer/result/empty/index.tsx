import { useSelector } from "react-redux";
import { useDictionary } from "../../../../../store/selectors/translations";

export const EmptyResultContainer = () => {

  const dictionary = useSelector(useDictionary);
  return (
    <div
      style={{
        display: 'flex',
        fontSize: '20px',
        lineHeight: '20px',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        textAlign: 'center',
      }}
    >
      {dictionary.label_no_result_part1}
      <br /> {dictionary.label_no_result_part2}
    </div>
  );
};
