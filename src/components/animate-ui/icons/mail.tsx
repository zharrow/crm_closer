'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

/**
 * Écrite à la main, dans le style du registre.
 *
 * Animate UI n'a aucune icône d'email — ni enveloppe, ni arobase, ni boîte de
 * réception. Comme le modèle du registre est de déposer le code chez soi,
 * écrire la pièce manquante au même format est la suite logique : elle
 * s'utilise exactement comme les autres, `animateOnHover` compris.
 *
 * Le rabat se soulève, et l'enveloppe accompagne d'un souffle. Les deux
 * ensemble parce que le canal se lit souvent en 12 px, dans une pastille :
 * un rabat seul y bougerait de moins de deux pixels et ne se verrait pas.
 *
 * Les deux tracés du rabat gardent la même suite de commandes — c'est ce qui
 * permet à Motion d'interpoler l'un vers l'autre.
 */
type MailProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    body: {
      initial: {
        y: 0,
        transition: { ease: 'easeInOut', duration: 0.4 },
      },
      animate: {
        y: -1,
        transition: { ease: 'easeInOut', duration: 0.4 },
      },
    },
    flap: {
      initial: {
        d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7',
        transition: { ease: 'easeInOut', duration: 0.4 },
      },
      animate: {
        d: 'm22 7-8.97 1.9a1.94 1.94 0 0 1-2.06 0L2 7',
        transition: { ease: 'easeInOut', duration: 0.4 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: MailProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      variants={variants.body}
      initial="initial"
      animate={controls}
      {...props}
    >
      <motion.rect width={20} height={16} x={2} y={4} rx={2} />
      <motion.path
        d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
        variants={variants.flap}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Mail(props: MailProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  Mail,
  Mail as MailIcon,
  type MailProps,
  type MailProps as MailIconProps,
};
