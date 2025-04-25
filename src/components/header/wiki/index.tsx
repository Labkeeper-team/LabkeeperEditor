import { useSelector } from 'react-redux';
import { Button } from '../../button';
import { useDictionary } from '../../../store/selectors/translations';
import { StorageState } from '../../../store';

export const WikiButton = () => {
    const dictionary = useSelector(useDictionary);
    const language = useSelector(
        (state: StorageState) => state.persistence.language
    );

    return (
        <Button
            title={dictionary.wiki}
            rounded
            minimize
            onPress={() =>
                window.open(
                    'https://github.com/Labkeeper-team/Docs/wiki/' + language,
                    '_blank'
                )
            }
            color={'inherit'}
        />
    );
};
