import { useSelector } from 'react-redux';
import { Button } from '../../button';
import { useDictionary } from '../../../store/selectors/translations';
import { GithubIcon } from '../../../icons';
import { WikiLinks } from '../../../../viewModel/wiki.ts';

export const WikiButton = () => {
    const dictionary = useSelector(useDictionary);

    return (
        <Button
            title={dictionary.wiki}
            rounded
            minimize
            titleIcon={() => <GithubIcon />}
            onPress={() => window.open(WikiLinks.home, '_blank')}
            color={'gray'}
        />
    );
};
