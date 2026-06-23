import {
    Utensils, Bus, Receipt, Home, Car, ShoppingBag, Gamepad2,
    Heart, Settings, Shield, ArrowUp, ArrowLeftRight, Briefcase,
    TrendingUp, User, Cpu, Ellipsis,
} from 'https://esm.sh/lucide-preact@1.21.0?deps=preact@10.25.4';

export const PARENT_ICONS = {
    Food: Utensils,
    Transport: Bus,
    Bills: Receipt,
    Housing: Home,
    Vehicle: Car,
    Shopping: ShoppingBag,
    Entertainment: Gamepad2,
    Health: Heart,
    Administration: Settings,
    Insurance: Shield,
    Income: ArrowUp,
    Transfer: ArrowLeftRight,
    Business: Briefcase,
    Investment: TrendingUp,
    Personal: User,
    Technology: Cpu,
    Other: Ellipsis,
};

export function getParentName(categoryName) {
    return categoryName.includes(':') ? categoryName.split(':')[0] : categoryName;
}

export function getChildName(categoryName) {
    return categoryName.includes(':') ? categoryName.split(':')[1] : categoryName;
}
