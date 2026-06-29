import type { ReactNode } from 'react';
import {
	MARK_BOLD,
	MARK_LINK,
	NODE_OL,
	NODE_UL,
	render,
	type RenderOptions,
} from 'storyblok-rich-text-react-renderer';
import type { StoryblokRichtext } from '@drumkit/storyblok/types/storyblok.d';
import { publicHref } from 'utils/storyblok';

type LinkMark = { href?: string; target?: string; anchor?: string };

//* Paragraphs and headings are left to the default renderer so they inherit the
//* typography of the wrapping element (e.g. headline1/body1 set by the caller).
//* Only links, bold and lists get explicit brand styling.
const options: RenderOptions = {
	markResolvers: {
		[MARK_LINK]: (children: ReactNode, props: LinkMark) => {
			const href = `${publicHref(props.href)}${props.anchor ? `#${props.anchor}` : ''}`;
			const target = props.target === '_blank' ? '_blank' : undefined;

			return (
				<a href={href} target={target} className="text-red underline hover:no-underline">
					{children}
				</a>
			);
		},
		[MARK_BOLD]: (children: ReactNode) => (
			<strong className="font-proxima_bold">{children}</strong>
		),
	},
	nodeResolvers: {
		[NODE_UL]: (children: ReactNode) => <ul className="list-disc pl-20">{children}</ul>,
		[NODE_OL]: (children: ReactNode) => <ol className="list-decimal pl-20">{children}</ol>,
	},
};

type Props = { text: string | StoryblokRichtext };

const RichTextRenderer = ({ text }: Props) => <>{render(text, options)}</>;

export default RichTextRenderer;
